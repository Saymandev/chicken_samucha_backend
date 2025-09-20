const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema({
  title: {
    en: {
      type: String,
      required: true,
      trim: true
    },
    bn: {
      type: String,
      required: true,
      trim: true
    }
  },
  description: {
    en: {
      type: String,
      required: true,
      trim: true
    },
    bn: {
      type: String,
      required: true,
      trim: true
    }
  },
  shortDescription: {
    en: {
      type: String,
      trim: true
    },
    bn: {
      type: String,
      trim: true
    }
  },
  image: {
    url: String,
    public_id: String
  },
  bannerImage: {
    url: String,
    public_id: String
  },
  // Promotion type
  type: {
    type: String,
    enum: ['discount', 'special_offer', 'announcement', 'seasonal', 'flash_sale'],
    default: 'discount'
  },
  // Discount details
  discountType: {
    type: String,
    enum: ['percentage', 'fixed_amount', 'buy_x_get_y', 'free_shipping'],
    default: 'percentage'
  },
  discountValue: {
    type: Number,
    min: 0
  },
  // Validity period
  validFrom: {
    type: Date,
    required: true
  },
  validUntil: {
    type: Date,
    required: true
  },
  // Display settings
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  // Target audience
  targetAudience: {
    type: String,
    enum: ['all', 'new_users', 'returning_users', 'vip_users'],
    default: 'all'
  },
  // Display frequency
  displayFrequency: {
    type: String,
    enum: ['once_per_session', 'once_per_day', 'always', 'custom'],
    default: 'once_per_session'
  },
  // Custom display rules
  displayRules: {
    showOnHomepage: {
      type: Boolean,
      default: true
    },
    showOnProductPage: {
      type: Boolean,
      default: false
    },
    showOnCartPage: {
      type: Boolean,
      default: false
    },
    showOnCheckout: {
      type: Boolean,
      default: false
    },
    minimumOrderAmount: {
      type: Number,
      default: 0
    }
  },
  // Call to action
  ctaButton: {
    text: {
      en: String,
      bn: String
    },
    link: String,
    action: {
      type: String,
      enum: ['navigate', 'apply_coupon', 'open_catalog', 'contact_us'],
      default: 'navigate'
    }
  },
  // Analytics
  analytics: {
    views: {
      type: Number,
      default: 0
    },
    clicks: {
      type: Number,
      default: 0
    },
    conversions: {
      type: Number,
      default: 0
    }
  },
  // SEO
  seoTitle: {
    en: String,
    bn: String
  },
  seoDescription: {
    en: String,
    bn: String
  },
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for better performance
promotionSchema.index({ validFrom: 1, validUntil: 1 });
promotionSchema.index({ isActive: 1, priority: -1 });
promotionSchema.index({ type: 1, targetAudience: 1 });

// Virtual for checking if promotion is currently valid
promotionSchema.virtual('isValid').get(function() {
  const now = new Date();
  return this.isActive && 
         this.validFrom <= now && 
         this.validUntil >= now;
});

// Virtual for time remaining
promotionSchema.virtual('timeRemaining').get(function() {
  const now = new Date();
  if (this.validUntil <= now) return 0;
  return this.validUntil.getTime() - now.getTime();
});

// Method to increment view count
promotionSchema.methods.incrementView = function() {
  this.analytics.views += 1;
  return this.save();
};

// Method to increment click count
promotionSchema.methods.incrementClick = function() {
  this.analytics.clicks += 1;
  return this.save();
};

// Method to increment conversion count
promotionSchema.methods.incrementConversion = function() {
  this.analytics.conversions += 1;
  return this.save();
};

// Static method to get active promotions
promotionSchema.statics.getActivePromotions = function(options = {}) {
  const now = new Date();
  const query = {
    isActive: true,
    validFrom: { $lte: now },
    validUntil: { $gte: now }
  };

  // Filter by target audience if specified
  if (options.targetAudience) {
    query.$or = [
      { targetAudience: 'all' },
      { targetAudience: options.targetAudience }
    ];
  }

  // Filter by type if specified
  if (options.type) {
    query.type = options.type;
  }

  return this.find(query)
    .sort({ priority: -1, createdAt: -1 })
    .limit(options.limit || 10);
};

// Pre-save middleware to validate dates
promotionSchema.pre('save', function(next) {
  if (this.validFrom >= this.validUntil) {
    return next(new Error('Valid from date must be before valid until date'));
  }
  next();
});

module.exports = mongoose.model('Promotion', promotionSchema);
