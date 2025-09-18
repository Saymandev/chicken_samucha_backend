const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// Public routes
router.get('/', categoryController.getAllCategories);
router.get('/navbar', categoryController.getNavbarCategories);
router.get('/:id', categoryController.getCategoryById);

// Admin routes (require authentication and admin role)
router.post('/', auth, adminAuth, categoryController.createCategory);
router.put('/:id', auth, adminAuth, categoryController.updateCategory);
router.delete('/:id', auth, adminAuth, categoryController.deleteCategory);
router.patch('/:id/toggle', auth, adminAuth, categoryController.toggleCategoryStatus);
router.patch('/order', auth, adminAuth, categoryController.updateCategoryOrder);

module.exports = router;
