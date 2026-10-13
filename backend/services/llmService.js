const axios = require('axios');

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const LANGUAGE_NAMES = {
  'te-IN': 'Telugu',
  'hi-IN': 'Hindi',
  'en-IN': 'English',
  'ta-IN': 'Tamil',
  'kn-IN': 'Kannada',
  'ml-IN': 'Malayalam',
  'bn-IN': 'Bengali',
  'mr-IN': 'Marathi',
  'gu-IN': 'Gujarati',
  'pa-IN': 'Punjabi',
  'od-IN': 'Odia',
};
const languageName = (code) => LANGUAGE_NAMES[code] || 'English';
const hasOpenAI = () => Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());

async function callOpenAI(messages, temperature = 0.4) {
  if (!hasOpenAI()) throw new Error('OPENAI_API_KEY is not set in backend/.env');
  const response = await axios.post(
    OPENAI_URL,
    {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      temperature,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 40000,
    }
  );
  return response.data.choices[0].message.content;
}

/**
 * Step 1: Extract crop name + location (state/district) from the farmer's
 * free-form question so we know what to fetch from Agmarknet/weather.
 */
async function extractCropAndLocation(farmerQuestion, fallbackState, fallbackDistrict) {
  const prompt = `Extract the crop name, state, and district from this farmer's question.
If state or district is not mentioned, use the fallback values given.
Respond ONLY with valid JSON in this exact format, no extra text:
{"crop": "...", "state": "...", "district": "..."}

Farmer's question: "${farmerQuestion}"
Fallback state: "${fallbackState}"
Fallback district: "${fallbackDistrict}"`;

  const defaults = { crop: 'Paddy', state: fallbackState, district: fallbackDistrict };
  if (!hasOpenAI()) return defaults;

  try {
    const raw = await callOpenAI([{ role: 'user', content: prompt }], 0.1);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      crop: parsed.crop || defaults.crop,
      state: parsed.state || defaults.state,
      district: parsed.district || defaults.district,
    };
  } catch (err) {
    console.error('extractCropAndLocation error:', err.message);
    return defaults;
  }
}

/**
 * Step 2: Given the farmer's question plus fetched live data (prices, weather,
 * advisory excerpt), generate a grounded, actionable recommendation.
 */
/**
 * Rule-based answer used when the LLM is unavailable (no key, quota, network).
 * It only states numbers that are present in the fetched data.
 */
function buildFallbackAdvice({ priceData, weatherData }) {
  const parts = [];

  if (priceData && priceData.found && priceData.records.length) {
    const rows = priceData.records
      .map((r) => ({ ...r, modal: Number(r.modalPrice) }))
      .filter((r) => Number.isFinite(r.modal));
    if (rows.length) {
      rows.sort((a, b) => b.modal - a.modal);
      const best = rows[0];
      const avg = Math.round(rows.reduce((s, r) => s + r.modal, 0) / rows.length);
      parts.push(
        `Paddy is trading at about ${avg} rupees per quintal on average across ${rows.length} markets. ` +
          `The best price is ${best.modal} rupees per quintal at ${best.market}${best.district ? `, ${best.district}` : ''}.`
      );
    }
  }
  if (parts.length === 0) parts.push('I could not load live mandi prices right now.');

  if (weatherData && weatherData.found && weatherData.forecast.length) {
    const rain = weatherData.forecast.slice(0, 3).reduce((s, d) => s + (d.totalRainMm || 0), 0);
    parts.push(
      rain >= 5
        ? `About ${Math.round(rain)} millimetres of rain is expected in the next three days, so keep harvested grain covered and avoid transport until it clears.`
        : 'The next three days look mostly dry, which is good for drying grain and moving it to the market.'
    );
  }
  return parts.join(' ');
}

/**
 * Step 2: Given the farmer's question plus fetched live data (prices, weather,
 * advisory excerpt), generate a grounded, actionable recommendation.
 * Returns { text, languageCode, source } - languageCode is the language the
 * text is actually written in, so text-to-speech uses the right voice.
 */
async function generateMarketAdvice({ question, priceData, weatherData, advisoryChunks, language }) {
  const languageCode = language || 'en-IN';
  const systemPrompt = `You are FarmMitra AI, a helpful farming advisor for Indian paddy farmers.
Answer in simple, clear language suitable for spoken text-to-speech playback.
Keep the answer under 120 words. Be specific and actionable - mention prices, market names,
and dates from the data given. Do not invent data not present in the context.
Write plain sentences only, with no markdown, bullet points or emojis.
Respond in this language: ${languageName(languageCode)}.`;

  const userPrompt = `Farmer's question: "${question}"

Live mandi price data:
${JSON.stringify(priceData, null, 2)}

Weather forecast:
${JSON.stringify(weatherData, null, 2)}

Relevant advisory notes:
${advisoryChunks.join('\n\n')}

Based on this data, give the farmer a clear recommendation on selling time and/or location,
and mention any relevant crop-care note from the advisory if applicable.`;

  try {
    const text = await callOpenAI(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      0.4
    );
    return { text: text.trim(), languageCode, source: 'llm' };
  } catch (err) {
    console.error('LLM advice failed, using rule-based fallback:', err.response ? JSON.stringify(err.response.data) : err.message);
    return { text: buildFallbackAdvice({ priceData, weatherData }), languageCode: 'en-IN', source: 'fallback' };
  }
}

/**
 * Phrase a due/upcoming task reminder naturally for TTS playback.
 */
async function phraseTaskReminder(tasks, language) {
  const languageCode = language || 'en-IN';
  if (!tasks || tasks.length === 0) {
    return { text: 'You have no pending tasks right now.', languageCode: 'en-IN' };
  }
  const prompt = `Phrase this list of farm tasks as a short, natural spoken reminder (under 60 words),
in ${languageName(languageCode)}. Plain sentences, no markdown. Tasks: ${tasks.map((t) => t.title).join('; ')}.`;

  try {
    const text = await callOpenAI([{ role: 'user', content: prompt }], 0.3);
    return { text: text.trim(), languageCode };
  } catch (err) {
    console.error('phraseTaskReminder error:', err.message);
    return {
      text: `You have ${tasks.length} pending task${tasks.length > 1 ? 's' : ''}: ${tasks.map((t) => t.title).join(', ')}.`,
      languageCode: 'en-IN',
    };
  }
}

module.exports = { extractCropAndLocation, generateMarketAdvice, phraseTaskReminder, buildFallbackAdvice };