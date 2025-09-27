const express = require('express');
const router = express.Router();
const { validationResult } = require('express-validator');
const categoryController = require('../controllers/categoryController');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { validateCategory } = require('../middleware/categoryValidation');

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Public routes
router.get('/', categoryController.getAllCategories);
router.get('/navbar', categoryController.getNavbarCategories);
router.get('/top', categoryController.getTopCategories);
router.get('/:id', categoryController.getCategoryById);

// Admin routes (require authentication and admin role)
router.post('/', protect, authorize('admin'), upload.categoryImage, validateCategory, handleValidationErrors, categoryController.createCategory);
router.put('/:id', protect, authorize('admin'), upload.categoryImage, validateCategory, handleValidationErrors, categoryController.updateCategory);
router.delete('/:id', protect, authorize('admin'), categoryController.deleteCategory);
router.patch('/:id/toggle', protect, authorize('admin'), categoryController.toggleCategoryStatus);
router.patch('/order', protect, authorize('admin'), categoryController.updateCategoryOrder);

module.exports = router;
