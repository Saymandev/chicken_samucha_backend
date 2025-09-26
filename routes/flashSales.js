const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const flashSaleController = require('../controllers/flashSaleController');
const { protect, authorize } = require('../middleware/auth');

// Validation middleware
const flashSaleValidation = [
  body('title.en').notEmpty().withMessage('English title is required'),
  body('title.bn').notEmpty().withMessage('Bengali title is required'),
  body('startTime').isISO8601().withMessage('Valid start time is required'),
  body('endTime').isISO8601().withMessage('Valid end time is required'),
  body('discountType').isIn(['percentage', 'fixed']).withMessage('Discount type must be percentage or fixed'),
  body('discountValue').isNumeric().isFloat({ min: 0 }).withMessage('Discount value must be a positive number'),
  body('products').isArray({ min: 1 }).withMessage('At least one product is required'),
  body('products.*.productId').notEmpty().withMessage('Product ID is required'),
  body('products.*.stockLimit').optional().isInt({ min: 1 }).withMessage('Stock limit must be a positive integer')
];

// Public routes
router.get('/current', flashSaleController.getCurrentFlashSales);
router.get('/upcoming', flashSaleController.getUpcomingFlashSales);
router.get('/:id', flashSaleController.getFlashSaleById);

// Admin routes
router.use(protect); // All routes below require authentication
router.use(authorize('admin')); // All routes below require admin role

router.get('/', flashSaleController.getAllFlashSales);
router.post('/', flashSaleValidation, flashSaleController.createFlashSale);
router.put('/:id', flashSaleController.updateFlashSale);
router.delete('/:id', flashSaleController.deleteFlashSale);
router.patch('/:id/toggle', flashSaleController.toggleFlashSaleStatus);

module.exports = router;
