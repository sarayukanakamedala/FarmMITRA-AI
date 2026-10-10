import React from 'react';
import Icon from './Icon';

export default function WeatherGlyph({ condition, size = 28 }) {
  const c = String(condition || '').toLowerCase();
  if (/rain|drizzle|thunder/.test(c)) return <Icon name="rain" size={size} />;
  if (/cloud|mist|haze|fog|smoke/.test(c)) return <Icon name="cloud" size={size} />;
  return <Icon name="sun" size={size} />;
}

/** Plain-language selling/field advice from the next three forecast days. */
export function weatherAdvice(forecast = []) {
  const next = forecast.slice(0, 3);
  if (next.length === 0) return null;
  const rain = next.reduce((s, d) => s + (d.totalRainMm || 0), 0);
  if (rain >= 20) {
    return { tone: 'warn', text: `Heavy rain likely in the next 3 days (about ${Math.round(rain)} mm). Keep harvested grain covered and hold off on transport.` };
  }
  if (rain >= 5) {
    return { tone: 'info', text: `Light showers expected (about ${Math.round(rain)} mm). Dry and cover grain before moving it to the mandi.` };
  }
  return { tone: 'good', text: 'Dry weather for the next 3 days. A good window for drying grain and transport.' };
}