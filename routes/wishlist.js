const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  addToWishlist,
  removeFromWishlist,
  getWishlist,
  checkWishlistStatus,
  getWishlistCount,
  clearWishlist
} = require('../controllers/wishlistController');

// All routes require authentication
router.use(protect);

// Add product to wishlist
router.post('/add/:productId', addToWishlist);

// Remove product from wishlist
router.delete('/remove/:productId', removeFromWishlist);

// Get user's wishlist
router.get('/', getWishlist);

// Check if product is in wishlist
router.get('/check/:productId', checkWishlistStatus);

// Get wishlist count
router.get('/count', getWishlistCount);

// Clear entire wishlist
router.delete('/clear', clearWishlist);

module.exports = router;
