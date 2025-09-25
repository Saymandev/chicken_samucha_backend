const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  name: {
    en: {
      type: String,
      required: true
    },
    bn: {
      type: String,
      required: true
    }
  },
  description: {
    en: String,
    bn: String
  },
  type: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  value: {
    type: Number,
    required: true,
    min: [0, 'Coupon value cannot be negative']
  },
  minOrderAmount: {
    type: Number,
    default: 0,
    min: [0, 'Minimum order amount cannot be negative']
  },
  maxDiscountAmount: {
    type: Number,
    min: [0, 'Maximum discount amount cannot be negative']
  },
  usageLimit: {
    type: Number,
    default: null // null means unlimited
  },
  usedCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date,
    required: true
  },
  applicableProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  applicableCategories: [{
    en: String,
    bn: String
  }],
  userRestrictions: {
    firstTimeOnly: {
      type: Boolean,
      default: false
    },
    minOrderCount: {
      type: Number,
      default: 0
    },
    specificUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  }
}, {
  timestamps: true
});

// Index for efficient queries
couponSchema.index({ code: 1, isActive: 1 });
couponSchema.index({ validFrom: 1, validUntil: 1 });
couponSchema.index({ isActive: 1, validUntil: 1 });

// Validate coupon value based on type
couponSchema.pre('save', function(next) {
  if (this.type === 'percentage' && this.value > 100) {
    return next(new Error('Percentage discount cannot exceed 100%'));
  }
  next();
});

// Method to check if coupon is valid
couponSchema.methods.isValid = function() {
  const now = new Date();
  return this.isActive && 
         this.validFrom <= now && 
         this.validUntil >= now &&
         (this.usageLimit === null || this.usageLimit === 0 || this.usedCount < this.usageLimit);
};

// Method to check if coupon is applicable to order
couponSchema.methods.isApplicableToOrder = async function(orderAmount, userId, orderProducts) {
  if (!this.isValid()) return false;
  
  // Check minimum order amount
  if (orderAmount < this.minOrderAmount) return false;
  
  // Check product restrictions
  if (this.applicableProducts.length > 0) {
    const hasApplicableProduct = orderProducts.some(productId => 
      this.applicableProducts.includes(productId)
    );
    if (!hasApplicableProduct) return false;
  }
  
  // Check user restrictions
  if (this.userRestrictions.specificUsers.length > 0) {
    if (!this.userRestrictions.specificUsers.includes(userId)) return false;
  }
  
  // Check minimum order count and first time user restrictions
  if (userId && (this.userRestrictions.minOrderCount > 0 || this.userRestrictions.firstTimeOnly)) {
    const Order = require('./Order');
    const userOrderCount = await Order.countDocuments({ 
      'customer.id': userId,
      status: { $in: ['delivered', 'completed'] } // Only count completed orders
    });
    
    // Check minimum order count
    if (this.userRestrictions.minOrderCount > 0 && userOrderCount < this.userRestrictions.minOrderCount) {
      return false;
    }
    
    // Check first time only restriction
    if (this.userRestrictions.firstTimeOnly && userOrderCount > 0) {
      return false;
    }
  }
  
  return true;
};

// Method to calculate discount
couponSchema.methods.calculateDiscount = function(orderAmount) {
  if (!this.isValid()) return 0;
  
  let discount = 0;
  
  if (this.type === 'percentage') {
    discount = (orderAmount * this.value) / 100;
  } else {
    discount = this.value;
  }
  
  // Apply maximum discount limit
  if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
    discount = this.maxDiscountAmount;
  }
  
  // Don't exceed order amount
  return Math.min(discount, orderAmount);
};

module.exports = mongoose.model('Coupon', couponSchema);
