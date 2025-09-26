const mongoose = require('mongoose');

const flashSaleSchema = new mongoose.Schema({
  title: {
    en: { type: String, required: true },
    bn: { type: String, required: true }
  },
  description: {
    en: { type: String },
    bn: { type: String }
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true
  },
  maxDiscountAmount: {
    type: Number // For percentage discounts
  },
  products: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    originalPrice: {
      type: Number,
      required: true
    },
    flashSalePrice: {
      type: Number,
      required: true
    },
    stockLimit: {
      type: Number // Limit quantity for flash sale
    },
    soldCount: {
      type: Number,
      default: 0
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  bannerImage: {
    url: String,
    public_id: String
  },
  backgroundColor: {
    type: String,
    default: '#dc2626' // Default red color
  },
  textColor: {
    type: String,
    default: '#ffffff' // Default white text
  },
  priority: {
    type: Number,
    default: 0 // Higher number = higher priority
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
flashSaleSchema.index({ startTime: 1, endTime: 1, isActive: 1 });
flashSaleSchema.index({ priority: -1 });

// Virtual to check if flash sale is currently active
flashSaleSchema.virtual('isCurrentlyActive').get(function() {
  const now = new Date();
  return this.isActive && now >= this.startTime && now <= this.endTime;
});

// Method to get remaining time
flashSaleSchema.methods.getRemainingTime = function() {
  const now = new Date();
  const endTime = new Date(this.endTime);
  const timeDiff = endTime - now;
  
  if (timeDiff <= 0) {
    return null;
  }
  
  const hours = Math.floor(timeDiff / (1000 * 60 * 60));
  const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
  
  return { hours, minutes, seconds, totalMs: timeDiff };
};

// Static method to get current active flash sales
flashSaleSchema.statics.getCurrentActive = function() {
  const now = new Date();
  return this.find({
    isActive: true,
    startTime: { $lte: now },
    endTime: { $gt: now }
  }).sort({ priority: -1 }).populate('products.product');
};

// Static method to get upcoming flash sales
flashSaleSchema.statics.getUpcoming = function() {
  const now = new Date();
  return this.find({
    isActive: true,
    startTime: { $gt: now }
  }).sort({ startTime: 1 }).populate('products.product');
};

module.exports = mongoose.model('FlashSale', flashSaleSchema);
