const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const {
  createRefundRequest,
  getMyRefunds
} = require('../controllers/refundController');

const router = express.Router();

// Validation rules
const refundValidation = [
  body('orderNumber')
    .notEmpty()
    .withMessage('Order number is required'),
  body('reason')
    .isIn(['order_cancelled', 'product_defective', 'wrong_item', 'not_as_described', 'late_delivery', 'customer_request', 'other'])
    .withMessage('Invalid refund reason'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('refundMethod')
    .optional()
    .isIn(['original_payment', 'bank_transfer', 'mobile_banking', 'store_credit'])
    .withMessage('Invalid refund method')
];

// Customer routes
router.post('/', protect, refundValidation, createRefundRequest);
router.get('/', protect, getMyRefunds);

module.exports = router;
