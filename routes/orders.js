const express = require('express');
const { body } = require('express-validator');
const orderController = require('../controllers/orderController');
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

// Order validation rules
const createOrderValidation = [
  body('customer.name').notEmpty().withMessage('Customer name is required'),
  body('customer.phone').matches(/^(\+8801|01)[3-9]\d{8}$/).withMessage('Valid BD phone number is required'),
  
  // Conditional address validation - only required for delivery method
  body('customer.address.street').custom((value, { req }) => {
    const deliveryMethod = req.body.deliveryInfo?.method;
    if (deliveryMethod === 'delivery' && (!value || value.trim() === '')) {
      throw new Error('Street address is required for delivery orders');
    }
    return true;
  }),
  
  body('customer.address.area').custom((value, { req }) => {
    const deliveryMethod = req.body.deliveryInfo?.method;
    if (deliveryMethod === 'delivery' && (!value || value.trim() === '')) {
      throw new Error('Area is required for delivery orders');
    }
    return true;
  }),
  
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('paymentInfo.method').isIn(['bkash', 'nagad', 'rocket', 'upay', 'cash_on_delivery', 'sslcommerz']).withMessage('Valid payment method is required'),
  
  // Validate delivery method
  body('deliveryInfo.method').isIn(['pickup', 'delivery']).withMessage('Valid delivery method is required')
];

// Order tracking validation
const trackOrderValidation = [
  body('orderNumber').notEmpty().withMessage('Order number is required'),
  body('phone').matches(/^(\+8801|01)[3-9]\d{8}$/).withMessage('Valid BD phone number is required')
];

// Return request validation
const returnRequestValidation = [
  body('orderNumber').notEmpty().withMessage('Order number is required'),
  body('reason').notEmpty().withMessage('Return reason is required')
];

// Debug route for testing authentication
router.get('/auth-test', protect, (req, res) => {
  res.json({
    success: true,
    message: 'Authentication working',
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role
    }
  });
});

// Public/User routes
router.post('/', optionalAuth, upload.paymentScreenshot.single('paymentScreenshot'), createOrderValidation, orderController.createOrder);
router.get('/my-orders', protect, orderController.getMyOrders);
router.get('/track/:orderNumber', orderController.trackOrder);

// Enhanced order tracking with phone verification
router.post('/track', trackOrderValidation, orderController.trackOrderWithPhone);

// Order return request
router.post('/return', returnRequestValidation, orderController.requestReturn);

// Admin routes
router.get('/', protect, authorize('admin'), orderController.getAllOrders);
router.get('/:id', protect, authorize('admin'), orderController.getOrder);
router.put('/:id/status', protect, authorize('admin'), orderController.updateOrderStatus);
router.put('/:id/payment-verification', protect, authorize('admin'), orderController.verifyPayment);
router.delete('/:id', protect, authorize('admin'), orderController.cancelOrder);

// Admin analytics
router.get('/analytics/dashboard', protect, authorize('admin'), orderController.getDashboardAnalytics);
router.get('/analytics/sales', protect, authorize('admin'), orderController.getSalesAnalytics);

module.exports = router; 