const Notification = require('../models/Notification');
const Order = require('../models/Order');
const User = require('../models/User');

// @desc    Get all notifications
// @route   GET /api/admin/notifications
// @access  Private (Admin)
exports.getNotifications = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      priority,
      read,
      category
    } = req.query;

    // Build query - Only show admin-specific notifications
    const query = {
      // Only show notifications that are meant for admin dashboard
      $or: [
        { userId: { $exists: false } }, // No user ID = admin notification
        { type: 'system' },
        { category: 'payment_processing' },
        { title: { $regex: /New Order|Payment Verification/i } }
      ]
    };
    
    // Apply additional filters
    if (type) query.type = type;
    if (priority) query.priority = priority;
    if (read !== undefined) query.read = read === 'true';
    if (category) query.category = category;

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get notifications with populated references
    const notifications = await Notification.find(query)
      .populate('orderId', 'orderNumber customer totalAmount')
      .populate('userId', 'name email')
      .populate('reviewId', 'rating comment')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Notification.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    // Get unread count for admin notifications only
    const unreadCount = await Notification.countDocuments({ 
      read: false,
      $or: [
        { userId: { $exists: false } },
        { type: 'system' },
        { category: 'payment_processing' },
        { title: { $regex: /New Order|Payment Verification/i } }
      ]
    });

    // Transform notifications for frontend
    const transformedNotifications = notifications.map(notification => ({
      id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      priority: notification.priority,
      read: notification.read,
      timestamp: notification.createdAt,
      orderId: notification.orderId ? notification.orderId.orderNumber : null,
      metadata: notification.metadata
    }));

    res.json({
      success: true,
      notifications: transformedNotifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: totalPages
      },
      unreadCount
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get single notification
// @route   GET /api/admin/notifications/:id
// @access  Private (Admin)
exports.getNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id)
      .populate('orderId', 'orderNumber customer totalAmount orderStatus')
      .populate('userId', 'name email phone')
      .populate('reviewId', 'rating comment customer');

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      notification: {
        id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        read: notification.read,
        timestamp: notification.createdAt,
        orderId: notification.orderId ? notification.orderId.orderNumber : null,
        metadata: notification.metadata,
        relatedData: {
          order: notification.orderId,
          user: notification.userId,
          review: notification.reviewId
        }
      }
    });
  } catch (error) {
    console.error('Get notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/admin/notifications/:id/read
// @access  Private (Admin)
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { 
        read: true, 
        readAt: new Date(),
        handledBy: req.user.id,
        handledAt: new Date()
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
      notification: {
        id: notification._id,
        read: notification.read,
        readAt: notification.readAt
      }
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/admin/notifications/mark-all-read
// @access  Private (Admin)
exports.markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { 
        read: false,
        // Only mark admin notifications as read
        $or: [
          { userId: { $exists: false } },
          { type: 'system' },
          { category: 'payment_processing' },
          { title: { $regex: /New Order|Payment Verification/i } }
        ]
      },
      { 
        read: true, 
        readAt: new Date(),
        handledBy: req.user.id,
        handledAt: new Date()
      }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete notification
// @route   DELETE /api/admin/notifications/:id
// @access  Private (Admin)
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await notification.deleteOne();

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Create notification (for testing/manual creation)
// @route   POST /api/admin/notifications
// @access  Private (Admin)
exports.createNotification = async (req, res) => {
  try {
    const { type, title, message, priority, orderId, userId, metadata } = req.body;

    const notificationData = {
      type,
      title,
      message,
      priority: priority || 'medium',
      metadata: metadata || {}
    };

    if (orderId) notificationData.orderId = orderId;
    if (userId) notificationData.userId = userId;

    const notification = await Notification.createNotification(notificationData);

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      notification: {
        id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        timestamp: notification.createdAt
      }
    });
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get notification statistics
// @route   GET /api/admin/notifications/stats
// @access  Private (Admin)
exports.getNotificationStats = async (req, res) => {
  try {
    const stats = await Notification.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unread: { $sum: { $cond: [{ $eq: ['$read', false] }, 1, 0] } },
          high_priority: { $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] } },
          medium_priority: { $sum: { $cond: [{ $eq: ['$priority', 'medium'] }, 1, 0] } },
          low_priority: { $sum: { $cond: [{ $eq: ['$priority', 'low'] }, 1, 0] } }
        }
      }
    ]);

    const typeStats = await Notification.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          unread: { $sum: { $cond: [{ $eq: ['$read', false] }, 1, 0] } }
        }
      }
    ]);

    res.json({
      success: true,
      stats: {
        overview: stats[0] || { total: 0, unread: 0, high_priority: 0, medium_priority: 0, low_priority: 0 },
        byType: typeStats
      }
    });
  } catch (error) {
    console.error('Get notification stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Helper function to create order-related notifications
exports.createOrderNotification = async (orderData, type = 'order') => {
  try {
    let title, message, priority = 'medium';

    switch (type) {
      case 'new_order':
        title = 'New Order Received';
        message = `Order ${orderData.orderNumber} from ${orderData.customer.name} needs confirmation`;
        priority = 'high';
        break;
      case 'payment_pending':
        title = 'Payment Verification Required';
        message = `${orderData.paymentMethod} payment screenshot uploaded for order ${orderData.orderNumber}`;
        priority = 'medium';
        break;
      case 'order_delivered':
        title = 'Order Delivered';
        message = `Order ${orderData.orderNumber} has been successfully delivered`;
        priority = 'low';
        break;
      default:
        title = 'Order Update';
        message = `Order ${orderData.orderNumber} status updated`;
    }

    const notification = await Notification.createNotification({
      type: 'order',
      title,
      message,
      priority,
      orderId: orderData.orderId,
      metadata: {
        orderNumber: orderData.orderNumber,
        customerName: orderData.customer.name,
        paymentMethod: orderData.paymentMethod,
        totalAmount: orderData.totalAmount
      }
    });

    return notification;
  } catch (error) {
    console.error('Error creating order notification:', error);
  }
};

// Helper function to create payment-related notifications
exports.createPaymentNotification = async (paymentData) => {
  try {
    const notification = await Notification.createNotification({
      type: 'payment',
      title: 'Payment Verification Required',
      message: `${paymentData.method} payment needs verification for order ${paymentData.orderNumber}`,
      priority: 'medium',
      orderId: paymentData.orderId,
      metadata: {
        paymentMethod: paymentData.method,
        transactionId: paymentData.transactionId,
        orderNumber: paymentData.orderNumber
      }
    });

    return notification;
  } catch (error) {
    console.error('Error creating payment notification:', error);
  }
}; 