const axios = require('axios');

const GEOCODE_URL = 'https://api.openweathermap.org/geo/1.0/direct';
const FORECAST_URL = 'https://api.openweathermap.org/data/2.5/forecast';

/**
 * Get a short-term weather forecast summary for a district/city name.
 */
async function getWeatherForecast(locationName, countryCode = 'IN') {
  try {
    const geo = await axios.get(GEOCODE_URL, {
      params: {
        q: `${locationName},${countryCode}`,
        limit: 1,
        appid: process.env.OPENWEATHER_API_KEY,
      },
    });

    if (!geo.data || geo.data.length === 0) {
      return { found: false, message: `Could not locate ${locationName} for weather forecast.` };
    }

    const { lat, lon } = geo.data[0];

    const forecast = await axios.get(FORECAST_URL, {
      params: {
        lat,
        lon,
        appid: process.env.OPENWEATHER_API_KEY,
        units: 'metric',
      },
    });

    // Summarize next 5 days (OpenWeather free tier gives 3-hour blocks, 5-day range)
    const daily = {};
    forecast.data.list.forEach((entry) => {
      const date = entry.dt_txt.split(' ')[0];
      if (!daily[date]) {
        daily[date] = { temps: [], rain: 0, condition: entry.weather[0].main };
      }
      daily[date].temps.push(entry.main.temp);
      daily[date].rain += entry.rain ? entry.rain['3h'] || 0 : 0;
    });

    const summary = Object.entries(daily).map(([date, d]) => ({
      date,
      avgTemp: Math.round(d.temps.reduce((a, b) => a + b, 0) / d.temps.length),
      totalRainMm: Math.round(d.rain * 10) / 10,
      condition: d.condition,
    }));

    return { found: true, location: locationName, forecast: summary };
  } catch (error) {
    console.error('Weather API error:', error.message);
    return { found: false, message: 'Could not fetch weather forecast right now.' };
  }
}

module.exports = { getWeatherForecast };
