const axios = require('axios');

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

async function callOpenAI(messages, temperature = 0.4) {
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

  try {
    const raw = await callOpenAI([{ role: 'user', content: prompt }], 0.1);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('extractCropAndLocation error:', err.message);
    return { crop: 'Paddy', state: fallbackState, district: fallbackDistrict };
  }
}

/**
 * Step 2: Given the farmer's question plus fetched live data (prices, weather,
 * advisory excerpt), generate a grounded, actionable recommendation.
 */
async function generateMarketAdvice({ question, priceData, weatherData, advisoryChunks, language }) {
  const systemPrompt = `You are FarmMitra AI, a helpful farming advisor for Indian paddy farmers.
Answer in simple, clear language suitable for spoken text-to-speech playback.
Keep the answer under 120 words. Be specific and actionable - mention prices, market names,
and dates from the data given. Do not invent data not present in the context.
Respond in this language: ${language || 'English'}.`;

  const userPrompt = `Farmer's question: "${question}"

Live mandi price data:
${JSON.stringify(priceData, null, 2)}

Weather forecast:
${JSON.stringify(weatherData, null, 2)}

Relevant advisory notes:
${advisoryChunks.join('\n\n')}

Based on this data, give the farmer a clear recommendation on selling time and/or location,
and mention any relevant crop-care note from the advisory if applicable.`;

  return callOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    0.4
  );
}

/**
 * Phrase a due/upcoming task reminder naturally for TTS playback.
 */
async function phraseTaskReminder(tasks, language) {
  if (!tasks || tasks.length === 0) {
    return 'You have no pending tasks right now.';
  }
  const prompt = `Phrase this list of farm tasks as a short, natural spoken reminder (under 60 words),
in ${language || 'English'}. Tasks: ${tasks.map((t) => t.title).join('; ')}.`;

  try {
    return await callOpenAI([{ role: 'user', content: prompt }], 0.3);
  } catch (err) {
    console.error('phraseTaskReminder error:', err.message);
    return `You have ${tasks.length} pending tasks: ${tasks.map((t) => t.title).join(', ')}.`;
  }
}

module.exports = { extractCropAndLocation, generateMarketAdvice, phraseTaskReminder };
