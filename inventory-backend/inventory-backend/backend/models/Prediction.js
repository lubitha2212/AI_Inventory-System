const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  predictions: { type: Array, default: [] }
});

module.exports = mongoose.model('Prediction', predictionSchema);
