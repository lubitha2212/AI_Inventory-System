const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  quantity: { type: Number, required: true }, // Current stock
  price: { type: Number, required: true },
  expiryDate: { type: Date, required: true },
  supplier: { type: String, required: true }, // ✅ For AI
  batch: { type: String },                    // ✅ Optional for tracking
  batchReceived: { type: Date },               // ✅ Useful for FIFO
  shelfLifeDays: { type: Number }              // ✅ For AI expiry calculations
}, { timestamps: true });

// ✅ Prevent OverwriteModelError
module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);
