const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  product: {
    type: mongoose.Schema.ObjectId,
    ref: 'Product',
    required: true
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index to ensure unique user-product combination
wishlistSchema.index({ user: 1, product: 1 }, { unique: true });

// Index for efficient queries
wishlistSchema.index({ user: 1, addedAt: -1 });

// Virtual to populate product details
wishlistSchema.virtual('productDetails', {
  ref: 'Product',
  localField: 'product',
  foreignField: '_id',
  justOne: true
});

// Ensure virtual fields are serialized
wishlistSchema.set('toJSON', { virtuals: true });
wishlistSchema.set('toObject', { virtuals: true });

// Static method to add product to wishlist
wishlistSchema.statics.addToWishlist = async function(userId, productId) {
  try {
    // Check if already exists
    const existing = await this.findOne({ user: userId, product: productId });
    if (existing) {
      throw new Error('Product already in wishlist');
    }

    const wishlistItem = new this({
      user: userId,
      product: productId
    });

    await wishlistItem.save();
    return wishlistItem;
  } catch (error) {
    throw error;
  }
};

// Static method to remove product from wishlist
wishlistSchema.statics.removeFromWishlist = async function(userId, productId) {
  try {
    const result = await this.findOneAndDelete({ user: userId, product: productId });
    if (!result) {
      throw new Error('Product not found in wishlist');
    }
    return result;
  } catch (error) {
    throw error;
  }
};

// Static method to get user's wishlist
wishlistSchema.statics.getUserWishlist = async function(userId, page = 1, limit = 20) {
  try {
    const skip = (page - 1) * limit;
    
    const wishlistItems = await this.find({ user: userId })
      .populate({
        path: 'product',
        select: 'name images price discountPrice isActive stock category description',
        populate: {
          path: 'category',
          select: 'name slug'
        }
      })
      .sort({ addedAt: -1 })
      .skip(skip)
      .limit(limit);

    // Filter out items where product is null (deleted products)
    const validItems = wishlistItems.filter(item => item.product !== null);
    
    console.log(`Found ${wishlistItems.length} wishlist items, ${validItems.length} valid items`);

    const total = await this.countDocuments({ user: userId });

    return {
      items: validItems,
      total: validItems.length,
      page,
      pages: Math.ceil(validItems.length / limit)
    };
  } catch (error) {
    throw error;
  }
};

// Static method to check if product is in wishlist
wishlistSchema.statics.isInWishlist = async function(userId, productId) {
  try {
    const item = await this.findOne({ user: userId, product: productId });
    return !!item;
  } catch (error) {
    throw error;
  }
};

module.exports = mongoose.model('Wishlist', wishlistSchema);
