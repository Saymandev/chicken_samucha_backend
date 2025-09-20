const express = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const {
  getAllRefunds,
  updateRefundStatus,
  getRefundStats
} = require('../controllers/refundController');

const router = express.Router();

// Validation rules
const updateRefundValidation = [
  body('status')
    .isIn(['pending', 'approved', 'rejected', 'processed', 'completed'])
    .withMessage('Invalid refund status'),
  body('adminNotes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Admin notes must be less than 1000 characters'),
  body('rejectionReason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Rejection reason must be less than 500 characters')
];

// Admin routes
router.get('/', protect, authorize('admin'), getAllRefunds);
router.put('/:id', protect, authorize('admin'), updateRefundValidation, updateRefundStatus);
router.get('/stats', protect, authorize('admin'), getRefundStats);

module.exports = router;
