const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/auth');

// Public routes
router.get('/', categoryController.getAllCategories);
router.get('/navbar', categoryController.getNavbarCategories);
router.get('/:id', categoryController.getCategoryById);

// Admin routes (require authentication and admin role)
router.post('/', auth, authorize('admin'), categoryController.createCategory);
router.put('/:id', auth, authorize('admin'), categoryController.updateCategory);
router.delete('/:id', auth, authorize('admin'), categoryController.deleteCategory);
router.patch('/:id/toggle', auth, authorize('admin'), categoryController.toggleCategoryStatus);
router.patch('/order', auth, authorize('admin'), categoryController.updateCategoryOrder);

module.exports = router;
