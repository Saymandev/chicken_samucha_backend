const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  customer: {
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true
    },
    phone: {
      type: String,
      match: [/^(\+8801|01)[3-9]\d{8}$/, 'Please enter a valid BD phone number']
    },
    email: {
      type: String,
      lowercase: true
    },
    avatar: {
      public_id: String,
      url: String
    }
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: false // Allow guest reviews
  },
  product: {
    type: mongoose.Schema.ObjectId,
    ref: 'Product',
    required: false // Allow general business reviews
  },
  originalProductName: {
    type: String,
    trim: true // Store original product name if product not found by ID
  },
  order: {
    type: mongoose.Schema.ObjectId,
    ref: 'Order',
    required: false
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot be more than 5']
  },
  title: {
    en: String,
    bn: String
  },
  comment: {
    en: {
      type: String,
      required: [true, 'Review comment is required'],
      maxlength: [500, 'Comment cannot be more than 500 characters']
    },
    bn: {
      type: String,
      maxlength: [500, 'Comment cannot be more than 500 characters']
    }
  },
  images: [{
    public_id: String,
    url: String
  }],
  reviewType: {
    type: String,
    enum: ['product', 'service', 'delivery', 'general'],
    default: 'general'
  },
  tags: [String], // e.g., ['taste', 'quality', 'delivery', 'packaging']
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'hidden'],
    default: 'pending'
  },
  adminResponse: {
    message: {
      en: String,
      bn: String
    },
    respondedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    respondedAt: Date
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationMethod: {
    type: String,
    enum: ['order_verified', 'phone_verified', 'manual', 'none'],
    default: 'none'
  },
  isVisible: {
    type: Boolean,
    default: false // Hidden until approved
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  helpfulVotes: {
    type: Number,
    default: 0
  },
  totalVotes: {
    type: Number,
    default: 0
  },
  moderationNotes: String,
  language: {
    type: String,
    enum: ['en', 'bn', 'both'],
    default: 'en'
  }
}, {
  timestamps: true
});

// Compound index for product reviews
reviewSchema.index({ product: 1, status: 1, isVisible: 1 });
reviewSchema.index({ rating: -1, createdAt: -1 });
reviewSchema.index({ status: 1 });
reviewSchema.index({ isFeatured: 1, isVisible: 1 });
reviewSchema.index({ user: 1 });

// Update product rating when review is approved
reviewSchema.post('save', async function() {
  if (this.product && this.status === 'approved' && this.isVisible) {
    const Product = mongoose.model('Product');
    const reviews = await mongoose.model('Review').find({
      product: this.product,
      status: 'approved',
      isVisible: true
    });
    
    if (reviews.length > 0) {
      const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
      await Product.findByIdAndUpdate(this.product, {
        'ratings.average': Math.round(averageRating * 10) / 10,
        'ratings.count': reviews.length
      });
    }
  }
});

module.exports = mongoose.model('Review', reviewSchema); 