const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['order', 'payment', 'system', 'chat', 'user', 'review'],
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
    index: true
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date
  },
  // Related entity references
  orderId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Order'
  },
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  chatId: {
    type: String
  },
  reviewId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Review'
  },
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // For system notifications
  category: {
    type: String,
    enum: ['order_management', 'payment_processing', 'user_activity', 'system_alerts', 'chat_support'],
    default: 'order_management'
  },
  // Admin who handled the notification
  handledBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  handledAt: {
    type: Date
  },
  // Auto-expire notifications after certain time
  expiresAt: {
    type: Date,
    index: { expireAfterSeconds: 0 }
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
notificationSchema.index({ read: 1, createdAt: -1 });
notificationSchema.index({ type: 1, priority: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });

// Pre-save middleware to set expiration for certain types
notificationSchema.pre('save', function(next) {
  if (this.isNew) {
    // Auto-expire notifications after 30 days
    if (!this.expiresAt) {
      this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
  }
  next();
});

// Static method to create notification
notificationSchema.statics.createNotification = async function(data) {
  try {
    // Validate required fields
    if (!data.type || !data.title || !data.message) {
      throw new Error('Missing required notification fields: type, title, message');
    }
    
    const notification = await this.create(data);
    
    // Emit real-time notification via Socket.IO
    if (global.io) {
      // Always emit to admin dashboard
      global.io.to('admin-dashboard').emit('new-notification', {
        id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        createdAt: notification.createdAt
      });
      
      // For user notifications - emit to user-specific room only if userId exists
      if (notification.userId) {
        
        global.io.to(`user-${notification.userId}`).emit('new-user-notification', {
          id: notification._id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          read: notification.read,
          timestamp: notification.createdAt
        });
       
      } else {
        
      }
    } else {
      
    }
    
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Static method to mark notifications as read
notificationSchema.statics.markAsRead = async function(notificationIds) {
  try {
    const result = await this.updateMany(
      { _id: { $in: notificationIds } },
      { 
        read: true, 
        readAt: new Date() 
      }
    );
    return result;
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    throw error;
  }
};

// Virtual to get time since creation
notificationSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
});

// Ensure virtual fields are serialized
notificationSchema.set('toJSON', { virtuals: true });
notificationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Notification', notificationSchema); 