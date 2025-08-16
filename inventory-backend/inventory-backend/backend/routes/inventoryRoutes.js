const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');

// Add product
router.post('/add', authMiddleware, requirePermission('create'), inventoryController.addProduct);

// Get products
router.get('/all', authMiddleware, requirePermission('read'), inventoryController.getProducts);

// Update product
router.put('/:id', authMiddleware, requirePermission('update'), inventoryController.updateProduct);

// Delete product
router.delete('/:id', authMiddleware, requirePermission('delete'), inventoryController.deleteProduct);

module.exports = router;
