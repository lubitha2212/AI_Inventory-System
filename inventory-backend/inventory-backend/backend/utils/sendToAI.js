const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

/**
 * Sends CSV files to AI Optimizer backend for predictions
 * @param {string} salesPath - Path to sales.csv file
 * @param {string} productsPath - Path to products.csv file
 * @returns {Promise<Object>} - AI Optimizer response
 */
async function sendToAI(salesPath, productsPath) {
  try {
    console.log('📤 Sending CSV files to AI Optimizer...');

    const form = new FormData();
    form.append('sales', fs.createReadStream(salesPath));
    form.append('products', fs.createReadStream(productsPath));

    const response = await axios.post(
      process.env.AI_URL || 'http://localhost:8000/api/predict', // AI backend URL
      form,
      { headers: form.getHeaders() }
    );

    console.log('✅ AI Optimizer response received:', response.data);
    return response.data;

  } catch (err) {
    console.error('❌ Error sending data to AI Optimizer:', err.message);
    throw new Error('Failed to send CSVs to AI Optimizer');
  }
}

module.exports = sendToAI;
