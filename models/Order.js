const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true
  },
  customer: {
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      match: [/^(\+8801|01)[3-9]\d{8}$/, 'Please enter a valid BD phone number']
    },
    email: {
      type: String,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email'
      ]
    },
    address: {
      street: {
        type: String,
        required: false
      },
      area: {
        type: String,
        required: false
      },
      city: {
        type: String,
        required: false,
        default: 'Rangpur'
      },
      district: {
        type: String,
        required: false,
        default: 'Rangpur'
      },
      postalCode: String,
      landmark: String
    }
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: false // Allow guest orders
  },
  items: [{
    product: {
      type: mongoose.Schema.ObjectId,
      ref: 'Product',
      required: true
    },
    name: {
      en: String,
      bn: String
    },
    price: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1']
    },
    subtotal: {
      type: Number,
      required: true
    }
  }],
  totalAmount: {
    type: Number,
    required: true,
    min: [0, 'Total amount cannot be negative']
  },
  deliveryCharge: {
    type: Number,
    default: 60,
    min: [0, 'Delivery charge cannot be negative']
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative']
  },
  finalAmount: {
    type: Number,
    required: true
  },
  paymentInfo: {
    method: {
      type: String,
      required: true,
      enum: ['bkash', 'nagad', 'rocket', 'upay', 'cash_on_delivery', 'sslcommerz']
    },
    transactionId: String,
    screenshot: {
      public_id: String,
      url: String
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'failed', 'refunded'],
      default: 'pending'
    },
    verifiedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    verificationDate: Date,
    paymentNumber: String, // The mobile number used for payment
    notes: String
  },
  orderStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'],
    default: 'pending'
  },
  statusHistory: [{
    status: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    updatedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    notes: String
  }],
  deliveryInfo: {
    method: {
      type: String,
      enum: ['delivery', 'pickup'],
      default: 'delivery'
    },
    address: String, // Store the formatted address string
    preferredTime: String,
    deliveryInstructions: String,
    deliveryDate: Date,
    deliveredAt: Date,
    deliveryPerson: String,
    deliveryPersonPhone: String
  },
  notes: String,
  adminNotes: String,
  isUrgent: {
    type: Boolean,
    default: false
  },
  estimatedDeliveryTime: {
    type: Date
  },
  rating: {
    value: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    createdAt: Date
  },
  cancelReason: String,
  refundAmount: Number,
  refundStatus: {
    type: String,
    enum: ['not_applicable', 'pending', 'processed', 'failed'],
    default: 'not_applicable'
  },
  refunds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Refund'
  }]
}, {
  timestamps: true
});

// Generate order number before saving
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const count = await mongoose.model('Order').countDocuments();
    this.orderNumber = `ORD${Date.now().toString().slice(-6)}${String(count + 1).padStart(3, '0')}`;
  }
  
  // Calculate final amount
  this.finalAmount = this.totalAmount + this.deliveryCharge - this.discount;
  
  // Add status to history if status changed
  if (this.isModified('orderStatus')) {
    this.statusHistory.push({
      status: this.orderStatus,
      timestamp: new Date(),
      updatedBy: this.modifiedBy || null
    });
  }
  
  next();
});

// Index for efficient queries
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ 'customer.phone': 1 });
orderSchema.index({ user: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ 'paymentInfo.status': 1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema); 