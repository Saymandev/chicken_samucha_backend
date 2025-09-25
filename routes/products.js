const express = require('express');
const { body } = require('express-validator');
const productController = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

// Public routes
router.get('/', productController.getProducts);
router.get('/featured', productController.getFeaturedProducts);
router.get('/by-ids', productController.getProductsByIds);
router.post('/by-ids', productController.getProductsByIds);
router.get('/:id', productController.getProduct);
router.get('/:id/related', productController.getRelatedProducts);
router.post('/:productId/track-cart', productController.trackAddToCart);

// Protected admin routes
router.post('/', 
  protect, 
  authorize('admin'), 
  upload.productImages.array('images', 5),
  [
    body('name.en').notEmpty().withMessage('English name is required'),
    body('name.bn').notEmpty().withMessage('Bengali name is required'),
    body('description.en').notEmpty().withMessage('English description is required'),
    body('description.bn').notEmpty().withMessage('Bengali description is required'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number')
  ],
  productController.createProduct
);

router.put('/:id', 
  protect, 
  authorize('admin'), 
  upload.productImages.array('images', 5),
  productController.updateProduct
);

router.delete('/:id', protect, authorize('admin'), productController.deleteProduct);

// Bulk operations
router.put('/bulk/update-visibility', protect, authorize('admin'), productController.bulkUpdateVisibility);
router.put('/bulk/update-availability', protect, authorize('admin'), productController.bulkUpdateAvailability);

// Analytics routes (Admin only)
router.get('/analytics/all', protect, authorize('admin'), productController.getAllProductsAnalytics);
router.get('/:id/analytics', protect, authorize('admin'), productController.getProductAnalytics);

// Public tracking routes
router.post('/track-purchase', productController.trackPurchase);

module.exports = router; 