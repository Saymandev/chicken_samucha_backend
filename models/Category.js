const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
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
      trim: true
    },
    bn: {
      type: String,
      trim: true
    }
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  image: {
    url: String,
    public_id: String
  },
  icon: {
    type: String, // For icon class or emoji
    default: '📦'
  },
  color: {
    type: String,
    default: '#3B82F6' // Default blue color
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  productCount: {
    type: Number,
    default: 0
  },
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  isSubcategory: {
    type: Boolean,
    default: false
  },
  seoTitle: {
    en: String,
    bn: String
  },
  seoDescription: {
    en: String,
    bn: String
  },
  seoKeywords: [String]
}, {
  timestamps: true
});

// Index for better performance
categorySchema.index({ slug: 1 });
categorySchema.index({ isActive: 1 });
categorySchema.index({ sortOrder: 1 });
categorySchema.index({ parentCategory: 1 });

// Virtual for getting products in this category
categorySchema.virtual('products', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'category'
});

// Method to update product count
categorySchema.methods.updateProductCount = async function() {
  const Product = mongoose.model('Product');
  const count = await Product.countDocuments({ 
    category: this._id,
    isVisible: true
  });
  this.productCount = count;
  await this.save();
  return count;
};

// Static method to get categories with product count (including parent reference populated)
categorySchema.statics.getCategoriesWithProductCount = async function() {
  const categories = await this.find({ isActive: true })
    .sort({ sortOrder: 1, createdAt: 1 })
    .populate('parentCategory', 'name slug')
    .lean();
  
  const Product = mongoose.model('Product');
  
  for (let category of categories) {
    const count = await Product.countDocuments({ 
      category: category._id,
      isVisible: true
    });
    category.productCount = count;
  }
  
  return categories;
};

// Pre-save middleware to generate slug
categorySchema.pre('save', function(next) {
  if (this.isModified('name.en')) {
    this.slug = this.name.en
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

module.exports = mongoose.model('Category', categorySchema);
