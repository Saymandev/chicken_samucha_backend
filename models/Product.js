const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
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
      required: true
    },
    bn: {
      type: String,
      required: true
    }
  },
  shortDescription: {
    en: String,
    bn: String
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  },
  discountPrice: {
    type: Number,
    min: [0, 'Discount price cannot be negative'],
    validate: {
      validator: function(val) {
        return !val || val < this.price;
      },
      message: 'Discount price must be less than regular price'
    }
  },
  images: [{
    public_id: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    }
  }],
  category: {
    en: {
      type: String,
      default: 'Samosa'
    },
    bn: {
      type: String,
      default: 'সমুচা'
    }
  },
  ingredients: {
    en: [String],
    bn: [String]
  },
  nutritionalInfo: {
    calories: Number,
    protein: String,
    carbs: String,
    fat: String,
    fiber: String
  },
  preparationTime: {
    type: String,
    default: '15-20 minutes'
  },
  servingSize: {
    type: String,
    default: '1 piece'
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  isVisible: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  stock: {
    type: Number,
    default: 100,
    min: [0, 'Stock cannot be negative']
  },
  minOrderQuantity: {
    type: Number,
    default: 1,
    min: [1, 'Minimum order quantity must be at least 1']
  },
  maxOrderQuantity: {
    type: Number,
    default: 50
  },
  tags: {
    en: [String],
    bn: [String]
  },
  seoTitle: {
    en: String,
    bn: String
  },
  seoDescription: {
    en: String,
    bn: String
  },
  displayOrder: {
    type: Number,
    default: 1
  },
  ratings: {
    average: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be negative'],
      max: [5, 'Rating cannot be more than 5']
    },
    count: {
      type: Number,
      default: 0
    }
  },
  // Analytics tracking
  analytics: {
    viewCount: {
      type: Number,
      default: 0
    },
    addToCartCount: {
      type: Number,
      default: 0
    },
    purchaseCount: {
      type: Number,
      default: 0
    },
    lastViewed: {
      type: Date
    }
  }
}, {
  timestamps: true
});

// Index for search and filtering
productSchema.index({ 'name.en': 'text', 'name.bn': 'text', 'description.en': 'text', 'description.bn': 'text' });
productSchema.index({ isVisible: 1, isAvailable: 1, displayOrder: 1 });
productSchema.index({ isFeatured: 1, isVisible: 1 });

module.exports = mongoose.model('Product', productSchema); 