const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { protect } = require('../middleware/auth');


// Public routes
router.get('/', categoryController.getAllCategories);
router.get('/navbar', categoryController.getNavbarCategories);
router.get('/:id', categoryController.getCategoryById);

// Admin routes (require authentication and admin role)
router.post('/', protect, authorize('admin'), categoryController.createCategory);
router.put('/:id', protect, authorize('admin'), categoryController.updateCategory);
router.delete('/:id', protect, authorize('admin'), categoryController.deleteCategory);
router.patch('/:id/toggle', protect, authorize('admin'), categoryController.toggleCategoryStatus);
router.patch('/order', protect, authorize('admin'), categoryController.updateCategoryOrder);

module.exports = router;
