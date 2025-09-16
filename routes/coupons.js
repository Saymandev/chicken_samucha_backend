const express = require('express');
const { body } = require('express-validator');
const couponController = require('../controllers/couponController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/active', couponController.getActiveCoupons);
router.post('/validate', couponController.validateCoupon);

// Protected user routes
router.post('/apply', protect, couponController.applyCoupon);

// Admin routes
router.post('/', 
  protect, 
  authorize('admin'),
  [
    body('code').notEmpty().withMessage('Coupon code is required'),
    body('name.en').notEmpty().withMessage('English name is required'),
    body('name.bn').notEmpty().withMessage('Bengali name is required'),
    body('type').isIn(['percentage', 'fixed']).withMessage('Type must be percentage or fixed'),
    body('value').isFloat({ min: 0 }).withMessage('Value must be a positive number'),
    body('validUntil').isISO8601().withMessage('Valid until must be a valid date')
  ],
  couponController.createCoupon
);

router.get('/', protect, authorize('admin'), couponController.getAllCoupons);
router.get('/:id', protect, authorize('admin'), couponController.getCoupon);
router.put('/:id', protect, authorize('admin'), couponController.updateCoupon);
router.delete('/:id', protect, authorize('admin'), couponController.deleteCoupon);

module.exports = router;
