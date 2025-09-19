const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');

// Add product to wishlist
exports.addToWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    // Validate productId
    if (!productId || productId === 'undefined' || productId === 'null') {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }

    console.log('Adding to wishlist - productId:', productId, 'userId:', userId);

    // Check if product exists and is active
    const product = await Product.findById(productId);
    if (!product) {
      console.log(`Product not found: ${productId}`);
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    console.log(`Product found: ${product.name}, isAvailable: ${product.isAvailable}, stock: ${product.stock}`);
    
    if (!product.isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Product is currently not available'
      });
    }

    // Add to wishlist
    const wishlistItem = await Wishlist.addToWishlist(userId, productId);
    
    res.status(201).json({
      success: true,
      message: 'Product added to wishlist',
      data: wishlistItem
    });
  } catch (error) {
    console.error('Add to wishlist error:', error);
    
    if (error.message === 'Product already in wishlist') {
      return res.status(400).json({
        success: false,
        message: 'Product already in wishlist'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to add product to wishlist'
    });
  }
};

// Remove product from wishlist
exports.removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    await Wishlist.removeFromWishlist(userId, productId);
    
    res.json({
      success: true,
      message: 'Product removed from wishlist'
    });
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    
    if (error.message === 'Product not found in wishlist') {
      return res.status(404).json({
        success: false,
        message: 'Product not found in wishlist'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to remove product from wishlist'
    });
  }
};

// Get user's wishlist
exports.getWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const result = await Wishlist.getUserWishlist(userId, parseInt(page), parseInt(limit));
    
    res.json({
      success: true,
      data: result.items,
      pagination: {
        page: result.page,
        pages: result.pages,
        total: result.total
      }
    });
  } catch (error) {
    console.error('Get wishlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wishlist'
    });
  }
};

// Check if product is in wishlist
exports.checkWishlistStatus = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    const isInWishlist = await Wishlist.isInWishlist(userId, productId);
    
    res.json({
      success: true,
      isInWishlist
    });
  } catch (error) {
    console.error('Check wishlist status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check wishlist status'
    });
  }
};

// Get wishlist count
exports.getWishlistCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const count = await Wishlist.countDocuments({ user: userId });
    
    res.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Get wishlist count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get wishlist count'
    });
  }
};

// Clear entire wishlist
exports.clearWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await Wishlist.deleteMany({ user: userId });
    
    res.json({
      success: true,
      message: 'Wishlist cleared successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Clear wishlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear wishlist'
    });
  }
};
