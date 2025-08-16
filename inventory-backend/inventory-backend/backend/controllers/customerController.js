const Product = require('../models/Product');
const Sale = require('../models/Sale');

// ✅ Browse available products
exports.browseProducts = async (req, res) => {
  try {
    const products = await Product.find({
      quantity: { $gt: 0 },
      expiryDate: { $gte: new Date() }
    });
    res.status(200).json(products);
  } catch (err) {
    console.error('Error browsing products:', err.message);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

// ✅ Buy a product
exports.buyProduct = async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    // Ensure only customers can buy
    if (!req.user || !req.user.id || req.user.role !== 'customer') {
      return res.status(401).json({ error: 'Unauthorized: Only customers can buy products' });
    }

    if (!productId || !quantity) {
      return res.status(400).json({ error: 'Missing productId or quantity' });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    if (product.quantity < quantity) {
      return res.status(400).json({ error: 'Insufficient quantity' });
    }
    if (new Date(product.expiryDate) < new Date()) {
      return res.status(400).json({ error: 'Product has expired' });
    }
    if (!product.supplier) {
      return res.status(400).json({ error: 'Product missing supplier info. Contact admin.' });
    }

    const unitPrice = product.price;
    const totalPrice = unitPrice * quantity;

    product.quantity -= quantity;
    await product.save();

    const sale = new Sale({
      productId: product._id,
      productName: product.name,
      customerId: req.user.id,
      quantitySold: quantity,
      unitPrice,
      totalPrice,
      date: new Date()
    });
    await sale.save();

    res.status(200).json({
      message: 'Product purchased successfully',
      product: { name: product.name, remainingQuantity: product.quantity },
      sale
    });
  } catch (err) {
    console.error('Error buying product:', err.message);
    res.status(500).json({ error: 'Failed to purchase product', details: err.message });
  }
};
