const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const SERVICE_URL = () => process.env.DISEASE_SERVICE_URL || 'http://localhost:8000/predict';

let labels = null;
try {
  labels = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'disease-service', 'class_labels.json'), 'utf-8'));
} catch (e) {
  labels = null;
}

/**
 * Clearly-labelled demo result used only when the Python service is not running,
 * so the rest of the app can still be shown end to end. Turn off with
 * ALLOW_DEMO_FALLBACKS=false in backend/.env.
 */
function demoResult() {
  const keys = Object.keys(labels);
  const info = labels[keys[Math.floor(Math.random() * keys.length)]];
  return {
    success: true,
    disease: info.display_name,
    confidence: Math.round((0.75 + Math.random() * 0.2) * 100) / 100,
    remedy: info.remedy,
    mode: 'MOCK - disease service is not running (demo result)',
  };
}

async function detectDisease(imageBuffer, originalFilename) {
  const form = new FormData();
  form.append('file', imageBuffer, { filename: originalFilename || 'leaf.jpg' });

  try {
    const response = await axios.post(SERVICE_URL(), form, { headers: form.getHeaders(), timeout: 30000 });
    return { success: true, ...response.data };
  } catch (err) {
    const unreachable = ['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED'].includes(err.code);
    console.error('Disease service error:', err.code || err.message);

    if (unreachable && labels && process.env.ALLOW_DEMO_FALLBACKS !== 'false') {
      console.warn('Disease service unreachable - returning a labelled demo result.');
      return demoResult();
    }
    return {
      success: false,
      message: unreachable
        ? 'The disease analysis service is not running. Start it with: cd disease-service, then python app.py'
        : `Could not analyze the image: ${(err.response && err.response.data && err.response.data.error) || err.message}`,
    };
  }
}

module.exports = { detectDisease };