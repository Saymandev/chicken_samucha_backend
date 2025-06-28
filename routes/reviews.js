const express = require('express');
const { body } = require('express-validator');
const reviewController = require('../controllers/reviewController');
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

// Review validation (only for POST requests)
const reviewValidation = [
  body('customer.name').notEmpty().withMessage('Customer name is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment.en').notEmpty().withMessage('Review comment is required')
];

// Public routes
router.get('/', reviewController.getReviews);
router.get('/featured', reviewController.getFeaturedReviews);

// Review creation route with validation
router.post('/', 
  optionalAuth, 
  upload.reviewImages.array('images', 3),
  reviewValidation, 
  reviewController.createReview
);

// Admin routes are now in routes/admin.js

module.exports = router; 