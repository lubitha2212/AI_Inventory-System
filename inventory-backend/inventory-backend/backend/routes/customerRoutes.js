const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const authMiddleware = require('../middleware/authMiddleware');

// ✅ Browse available products
router.get('/products', authMiddleware, customerController.browseProducts);

// ✅ Buy a product (only customers)
router.post('/buy', authMiddleware, customerController.buyProduct);

module.exports = router;
