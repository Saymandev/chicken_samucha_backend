const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  orderNumber: {
    type: String,
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  reason: {
    type: String,
    required: true,
    enum: [
      'order_cancelled',
      'product_defective',
      'wrong_item',
      'not_as_described',
      'late_delivery',
      'customer_request',
      'other'
    ]
  },
  description: {
    type: String,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'processed', 'completed'],
    default: 'pending'
  },
  refundMethod: {
    type: String,
    enum: ['original_payment', 'bank_transfer', 'mobile_banking', 'store_credit'],
    default: 'original_payment'
  },
  refundDetails: {
    // For bank transfer
    bankName: String,
    accountNumber: String,
    accountHolderName: String,
    
    // For mobile banking
    mobileNumber: String,
    provider: String, // bkash, nagad, rocket, upay
    
    // For store credit
    creditAmount: Number,
    creditExpiry: Date
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: Date,
  adminNotes: String,
  rejectionReason: String,
  transactionId: String, // External transaction ID
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
refundSchema.index({ order: 1 });
refundSchema.index({ customer: 1 });
refundSchema.index({ status: 1 });
refundSchema.index({ createdAt: -1 });

// Update the updatedAt field before saving
refundSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for refund status display
refundSchema.virtual('statusDisplay').get(function() {
  const statusMap = {
    pending: 'Pending Review',
    approved: 'Approved',
    rejected: 'Rejected',
    processed: 'Processing',
    completed: 'Completed'
  };
  return statusMap[this.status] || this.status;
});

// Virtual for reason display
refundSchema.virtual('reasonDisplay').get(function() {
  const reasonMap = {
    order_cancelled: 'Order Cancelled',
    product_defective: 'Product Defective',
    wrong_item: 'Wrong Item Received',
    not_as_described: 'Not as Described',
    late_delivery: 'Late Delivery',
    customer_request: 'Customer Request',
    other: 'Other'
  };
  return reasonMap[this.reason] || this.reason;
});

module.exports = mongoose.model('Refund', refundSchema);
