// controllers/inventoryController.js
const Product = require('../models/Product');

// ✅ Add product (Admin)
exports.addProduct = async (req, res) => {
  try {
    const { name, quantity, price, expiryDate, supplier, batch, batchReceived, shelfLifeDays } = req.body;

    // Validation
    if (!expiryDate || isNaN(Date.parse(expiryDate))) {
      return res.status(400).json({ error: 'Valid expiryDate is required' });
    }
    if (!supplier) {
      return res.status(400).json({ error: 'Supplier is required' });
    }

    // Create product
    const product = new Product({
      name,
      quantity,
      price,
      expiryDate,
      supplier,
      batch: batch || null,
      batchReceived: batchReceived || null,
      shelfLifeDays: shelfLifeDays || null
    });

    await product.save();

    res.status(201).json({
      message: '✅ Product added successfully',
      product
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ✅ View all products
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Update product
exports.updateProduct = async (req, res) => {
  try {
    const { expiryDate } = req.body;
    if (expiryDate && isNaN(Date.parse(expiryDate))) {
      return res.status(400).json({ error: 'Invalid expiryDate format' });
    }
    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Product not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ✅ Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
