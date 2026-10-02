const axios = require('axios');
const FormData = require('form-data');

/**
 * Sends a leaf image to the Python Flask/FastAPI CNN microservice
 * and returns the predicted disease + confidence + remedy.
 */
async function detectDisease(imageBuffer, originalFilename) {
  const form = new FormData();
  form.append('file', imageBuffer, { filename: originalFilename || 'leaf.jpg' });

  try {
    const response = await axios.post(process.env.DISEASE_SERVICE_URL, form, {
      headers: form.getHeaders(),
      timeout: 15000,
    });
    return { success: true, ...response.data };
  } catch (err) {
    console.error('Disease service error:', err.message);
    return {
      success: false,
      message: 'Could not analyze the image right now. Please try again.',
    };
  }
}

module.exports = { detectDisease };
