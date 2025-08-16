const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true 
  },
  productName: { 
    type: String, 
    required: true 
  },
  customerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true // ✅ Now mandatory
  },
  quantitySold: { 
    type: Number, 
    required: true 
  },
  unitPrice: { 
    type: Number, 
    required: true 
  },
  totalPrice: { 
    type: Number, 
    required: true 
  },
  date: { 
    type: Date, 
    default: Date.now 
  }
}, { timestamps: true });

module.exports = mongoose.models.Sale || mongoose.model('Sale', saleSchema);
