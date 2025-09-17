const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Review = require('../models/Review');
const HeroContent = require('../models/HeroContent');
const SliderItem = require('../models/SliderItem');
const Settings = require('../models/Settings');

// Dashboard Statistics
exports.getDashboardStats = async (req, res) => {
  try {
    
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);

    // Basic counts
    const [
      totalUsers,
      totalOrders,
      totalProducts,
      totalReviews,
      approvedReviews,
      pendingOrders,
      completedOrders
    ] = await Promise.all([
      User.countDocuments(),
      Order.countDocuments(),
      Product.countDocuments(),
      Review.countDocuments(),
      Review.countDocuments({ status: 'approved', isVisible: true }),
      Order.countDocuments({ orderStatus: 'pending' }),
      Order.countDocuments({ orderStatus: 'delivered' })
    ]);

   

    // Revenue calculations - exclude cancelled orders
    const revenueData = await Order.aggregate([
      { $match: { orderStatus: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$finalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const monthlyRevenueData = await Order.aggregate([
      { 
        $match: { 
          orderStatus: { $ne: 'cancelled' },
          createdAt: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          monthlyRevenue: { $sum: '$finalAmount' },
          monthlyOrders: { $sum: 1 }
        }
      }
    ]);

    const lastMonthRevenueData = await Order.aggregate([
      { 
        $match: { 
          orderStatus: { $ne: 'cancelled' },
          createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
        }
      },
      {
        $group: {
          _id: null,
          lastMonthRevenue: { $sum: '$finalAmount' },
          lastMonthOrders: { $sum: 1 }
        }
      }
    ]);

    

    // Users this month
    const newUsersThisMonth = await User.countDocuments({
      createdAt: { $gte: startOfMonth }
    });

    const lastMonthUsers = await User.countDocuments({
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
    });

    // Weekly orders
    const weeklyOrders = await Order.countDocuments({
      createdAt: { $gte: startOfWeek }
    });

    // Average rating calculation - only approved and visible reviews
    const avgRatingData = await Review.aggregate([
      { $match: { status: 'approved', isVisible: true } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    

    // Pending reviews (not approved yet)
    const pendingReviews = await Review.countDocuments({
      status: 'pending'
    });

    // Recent orders
    const recentOrders = await Order.find()
      .populate('user', 'name phone email')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('orderNumber user customer finalAmount orderStatus createdAt paymentInfo')
      .lean();

 

    // Top products by order frequency
    const topProducts = await Order.aggregate([
      { $match: { orderStatus: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          sales: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.subtotal' }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          name: { $ifNull: ['$product.name.en', 'Unknown Product'] },
          sales: 1,
          revenue: 1
        }
      },
      { $sort: { sales: -1 } },
      { $limit: 5 }
    ]);

    

    // Calculate growth percentages
    const currentRevenue = monthlyRevenueData[0]?.monthlyRevenue || 0;
    const lastRevenue = lastMonthRevenueData[0]?.lastMonthRevenue || 0;
    const revenueGrowth = lastRevenue > 0 ? ((currentRevenue - lastRevenue) / lastRevenue * 100) : 
                         (currentRevenue > 0 ? 100 : 0);

    const currentOrders = monthlyRevenueData[0]?.monthlyOrders || 0;
    const lastOrders = lastMonthRevenueData[0]?.lastMonthOrders || 0;
    const ordersGrowth = lastOrders > 0 ? ((currentOrders - lastOrders) / lastOrders * 100) : 
                        (currentOrders > 0 ? 100 : 0);

    const usersGrowth = lastMonthUsers > 0 ? ((newUsersThisMonth - lastMonthUsers) / lastMonthUsers * 100) : 
                       (newUsersThisMonth > 0 ? 100 : 0);

    const stats = {
      totalUsers,
      totalOrders,
      totalRevenue: revenueData[0]?.totalRevenue || 0,
      totalProducts,
      pendingOrders,
      completedOrders,
      averageRating: avgRatingData[0]?.averageRating || 0,
      totalReviews: approvedReviews, // Only count approved reviews
      monthlyRevenue: currentRevenue,
      weeklyOrders,
      newUsersThisMonth,
      pendingReviews,
      monthlyGrowth: {
        revenue: Math.round(revenueGrowth * 10) / 10,
        orders: Math.round(ordersGrowth * 10) / 10,
        users: Math.round(usersGrowth * 10) / 10
      },
      recentOrders: recentOrders.map(order => ({
        id: order._id,
        orderNumber: order.orderNumber,
        customer: {
          name: order.user?.name || order.customer?.name || 'Guest Customer',
          phone: order.user?.phone || order.customer?.phone || 'N/A'
        },
        totalAmount: order.finalAmount || order.totalAmount,
        status: order.orderStatus,
        createdAt: order.createdAt,
        paymentStatus: order.paymentInfo?.status || 'pending'
      })),
      topProducts: topProducts.length > 0 ? topProducts : [
        { _id: 'sample1', name: 'Chicken Samosa', sales: 0, revenue: 0 },
        { _id: 'sample2', name: 'Beef Samosa', sales: 0, revenue: 0 },
        { _id: 'sample3', name: 'Vegetable Samosa', sales: 0, revenue: 0 }
      ]
    };

    

    res.json({ success: true, stats });
  } catch (error) {
    console.error('❌ Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard statistics' });
  }
};

// Get all orders
exports.getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, paymentMethod, sort = '-createdAt' } = req.query;
    const query = {};
    
    if (status) query.status = status;
    if (paymentMethod) query['paymentInfo.method'] = paymentMethod;

    const orders = await Order.find(query)
      .populate('customer', 'name phone email')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      orders,
      pagination: { page: parseInt(page), pages: Math.ceil(total / limit), total }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
};

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, role, isActive, sort = '-createdAt' } = req.query;
    const query = {};
    
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const users = await User.find(query)
      .select('-password')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      users,
      pagination: { page: parseInt(page), pages: Math.ceil(total / limit), total }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
};

// Update order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

   

    const updateData = { orderStatus: status };

    // Add delivery timestamp when marked as delivered
    if (status === 'delivered') {
      updateData['deliveryInfo.deliveredAt'] = new Date();
    }

    const order = await Order.findByIdAndUpdate(
      orderId, 
      updateData, 
      { new: true }
    );
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    

    res.json({ success: true, message: 'Order status updated successfully', order });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update order status' });
  }
};

// Verify payment
exports.verifyPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
   
    
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Update payment status and auto-confirm order
    order.set('paymentInfo.status', 'verified');
    order.set('paymentInfo.verifiedBy', req.user?.id);
    order.set('paymentInfo.verificationDate', new Date());
    
    // Auto-confirm order when payment is verified
    if (order.orderStatus === 'pending') {
      order.set('orderStatus', 'confirmed');
    }
    
    await order.save();

    // Create notification for payment verification
    try {
      const { createPaymentNotification } = require('./notificationController');
      await createPaymentNotification({
        orderId: order._id,
        orderNumber: order.orderNumber,
        method: order.paymentInfo.method,
        transactionId: order.paymentInfo.transactionId
      });
    } catch (error) {
      console.error('Error creating payment notification:', error);
    }
    

    res.json({ success: true, message: 'Payment verified successfully', order });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify payment' });
  }
};

// Update user status
exports.updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    const user = await User.findByIdAndUpdate(userId, { isActive }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, message: 'User status updated successfully', user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update user status' });
  }
};

// Update user role
exports.updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    const user = await User.findByIdAndUpdate(userId, { role }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, message: 'User role updated successfully', user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update user role' });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findByIdAndDelete(userId);
    
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
};

// Update product
exports.updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await Product.findByIdAndUpdate(productId, req.body, { new: true });
    
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    res.json({ success: true, message: 'Product updated successfully', product });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update product' });
  }
};

// Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await Product.findByIdAndDelete(productId);
    
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete product' });
  }
};

// Content Management
exports.getHeroContent = async (req, res) => {
  try {
    let heroContent = await HeroContent.findOne();
    if (!heroContent) {
      heroContent = new HeroContent({
        title: { en: 'Delicious Chicken Samosa', bn: 'সুস্বাদু চিকেন সমুচা' },
        subtitle: { en: 'Fresh, crispy, and made with love', bn: 'তাজা, খাস্তা এবং ভালোবাসায় তৈরি' },
        description: { en: 'Order now and experience the authentic taste of Bangladesh', bn: 'এখনই অর্ডার করুন এবং বাংলাদেশের খাঁটি স্বাদ উপভোগ করুন' },
        buttonText: { en: 'Order Now', bn: 'এখনই অর্ডার করুন' },
        backgroundImage: { url: '', public_id: '' }
      });
      await heroContent.save();
    }

    res.json({ success: true, content: heroContent });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch hero content' });
  }
};

exports.updateHeroContent = async (req, res) => {
  try {
    const heroContent = await HeroContent.findOneAndUpdate({}, req.body, { new: true, upsert: true });
    res.json({ success: true, message: 'Hero content updated successfully', content: heroContent });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update hero content' });
  }
};

exports.getSliderItems = async (req, res) => {
  try {
    const sliderItems = await SliderItem.find().sort({ order: 1 });
    res.json({ success: true, items: sliderItems });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch slider items' });
  }
};

exports.toggleSliderItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const sliderItem = await SliderItem.findById(itemId);
    
    if (!sliderItem) return res.status(404).json({ success: false, message: 'Slider item not found' });

    sliderItem.isActive = !sliderItem.isActive;
    await sliderItem.save();

    res.json({ success: true, message: 'Slider item updated successfully', item: sliderItem });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update slider item' });
  }
};

// Payment Settings
exports.getPaymentSettings = async (req, res) => {
  try {
    const paymentSettings = await Settings.getPaymentSettings();
    res.json({ success: true, settings: paymentSettings });
  } catch (error) {
    console.error('Get payment settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payment settings' });
  }
};

exports.updatePaymentSettings = async (req, res) => {
  try {
    
    const updatedSettings = await Settings.savePaymentSettings(req.body, req.user?.id);
    res.json({ 
      success: true, 
      message: 'Payment settings updated successfully', 
      settings: updatedSettings 
    });
  } catch (error) {
    console.error('Update payment settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to update payment settings' });
  }
};

// Get recent activities
exports.getRecentActivities = async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    // Get recent orders, reviews, and user registrations
    const [recentOrders, recentReviews, recentUsers] = await Promise.all([
      Order.find()
        .populate('customer', 'name')
        .sort({ createdAt: -1 })
        .limit(10)
        .select('orderNumber customer status totalAmount createdAt'),
      
      Review.find()
        .populate('product', 'name')
        .sort({ createdAt: -1 })
        .limit(5)
        .select('customer rating comment createdAt'),
      
      User.find({ role: 'user' })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name email createdAt')
    ]);

    const activities = [];

    // Add orders to activities
    recentOrders.forEach(order => {
      activities.push({
        type: 'order',
        title: `New order ${order.orderNumber}`,
        description: `${order.customer?.name || 'Guest'} placed an order for ৳${order.totalAmount}`,
        timestamp: order.createdAt,
        status: order.status
      });
    });

    // Add reviews to activities
    recentReviews.forEach(review => {
      activities.push({
        type: 'review',
        title: 'New review',
        description: `${review.customer?.name || 'Customer'} left a ${review.rating}-star review`,
        timestamp: review.createdAt,
        status: 'active'
      });
    });

    // Add user registrations to activities
    recentUsers.forEach(user => {
      activities.push({
        type: 'user',
        title: 'New user registered',
        description: `${user.name} joined the platform`,
        timestamp: user.createdAt,
        status: 'active'
      });
    });

    // Sort all activities by timestamp and limit
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const limitedActivities = activities.slice(0, parseInt(limit));

    res.json({
      success: true,
      count: limitedActivities.length,
      activities: limitedActivities
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch recent activities' });
  }
};

// Get single user
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get user's order statistics
    const [totalOrders, totalSpent, lastOrder] = await Promise.all([
      Order.countDocuments({ customer: user._id }),
      Order.aggregate([
        { $match: { customer: user._id, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      Order.findOne({ customer: user._id })
        .sort({ createdAt: -1 })
        .select('orderNumber status createdAt')
    ]);

    res.json({
      success: true,
      user: {
        ...user.toObject(),
        statistics: {
          totalOrders,
          totalSpent: totalSpent[0]?.total || 0,
          lastOrder
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch user details' });
  }
};

// Get system settings
exports.getSystemSettings = async (req, res) => {
  try {
    const Settings = require('../models/Settings');
    const { category } = req.query;

    let settings;

    if (category) {
      // Get specific category settings
      switch (category) {
        case 'payment':
          settings = await Settings.getPaymentSettings();
          break;
        case 'general':
          settings = await Settings.getByCategory('general');
          break;
        case 'notification':
          settings = await Settings.getByCategory('notification');
          break;
        case 'delivery':
          settings = await Settings.getByCategory('delivery');
          break;
        case 'security':
          settings = await Settings.getByCategory('security');
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid category. Valid categories: payment, general, notification, delivery, security'
          });
      }
    } else {
      // Get all settings
      const [general, notification, delivery, security, payment] = await Promise.all([
        Settings.getByCategory('general'),
        Settings.getByCategory('notification'),
        Settings.getByCategory('delivery'),
        Settings.getByCategory('security'),
        Settings.getPaymentSettings()
      ]);

      settings = {
        general: {
          siteName: general.siteName || 'Chicken Samosa Business',
          currency: general.currency || 'BDT',
          deliveryCharge: general.deliveryCharge || 60,
          taxRate: general.taxRate || 0,
          minOrderAmount: general.minOrderAmount || 50,
          maxOrderAmount: general.maxOrderAmount || 10000,
          businessHours: general.businessHours || '9:00 AM - 10:00 PM',
          timezone: general.timezone || 'Asia/Dhaka',
          ...general
        },
        notification: {
          emailNotifications: notification.emailNotifications !== false,
          smsNotifications: notification.smsNotifications || false,
          orderNotifications: notification.orderNotifications !== false,
          reviewNotifications: notification.reviewNotifications !== false,
          marketingEmails: notification.marketingEmails || false,
          ...notification
        },
        delivery: {
          deliveryRadius: delivery.deliveryRadius || 10,
          deliveryTime: delivery.deliveryTime || '30-45 minutes',
          freeDeliveryThreshold: delivery.freeDeliveryThreshold || 500,
          deliveryAreas: delivery.deliveryAreas || [],
          ...delivery
        },
        security: {
          requireEmailVerification: security.requireEmailVerification !== false,
          requirePhoneVerification: security.requirePhoneVerification || false,
          maxLoginAttempts: security.maxLoginAttempts || 5,
          sessionTimeout: security.sessionTimeout || 24,
          ...security
        },
        payment
      };
    }

    res.json({ 
      success: true, 
      settings,
      category: category || 'all',
      lastUpdated: new Date()
    });
  } catch (error) {
    console.error('Get system settings error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch system settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update system settings
exports.updateSystemSettings = async (req, res) => {
  try {
    const Settings = require('../models/Settings');
    const { settings, category } = req.body;
    const userId = req.user.id;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Settings object is required'
      });
    }

    let result;

    // Handle different categories of settings
    switch (category) {
      case 'payment':
        result = await Settings.savePaymentSettings(settings, userId);
        break;
      
      case 'general':
        // Handle general settings
        const generalUpdates = Object.entries(settings).map(([key, value]) => 
          Settings.setSetting('general', key, value, userId)
        );
        await Promise.all(generalUpdates);
        result = await Settings.getByCategory('general');
        break;
      
      case 'notification':
        // Handle notification settings
        const notificationUpdates = Object.entries(settings).map(([key, value]) => 
          Settings.setSetting('notification', key, value, userId)
        );
        await Promise.all(notificationUpdates);
        result = await Settings.getByCategory('notification');
        break;
      
      case 'delivery':
        // Handle delivery settings
        const deliveryUpdates = Object.entries(settings).map(([key, value]) => 
          Settings.setSetting('delivery', key, value, userId)
        );
        await Promise.all(deliveryUpdates);
        result = await Settings.getByCategory('delivery');
        break;
      
      case 'security':
        // Handle security settings
        const securityUpdates = Object.entries(settings).map(([key, value]) => 
          Settings.setSetting('security', key, value, userId)
        );
        await Promise.all(securityUpdates);
        result = await Settings.getByCategory('security');
        break;
      
      default:
        // Handle bulk settings update (all categories)
        const allUpdates = [];
        Object.entries(settings).forEach(([settingCategory, settingValues]) => {
          if (typeof settingValues === 'object' && settingValues !== null) {
            Object.entries(settingValues).forEach(([key, value]) => {
              allUpdates.push(
                Settings.setSetting(settingCategory, key, value, userId)
              );
            });
          }
        });
        await Promise.all(allUpdates);
        result = settings;
    }

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: result,
      category: category || 'all',
      updatedBy: userId,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Update system settings error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update system settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get settings by category
exports.getSettingsByCategory = async (req, res) => {
  try {
    const Settings = require('../models/Settings');
    const { category } = req.params;

    if (!['payment', 'general', 'notification', 'delivery', 'security'].includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category. Valid categories: payment, general, notification, delivery, security'
      });
    }

    let settings;
    if (category === 'payment') {
      settings = await Settings.getPaymentSettings();
    } else {
      settings = await Settings.getByCategory(category);
    }

    res.json({
      success: true,
      settings,
      category
    });
  } catch (error) {
    console.error('Get settings by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Reset settings to defaults
exports.resetSettingsToDefaults = async (req, res) => {
  try {
    const Settings = require('../models/Settings');
    const { category } = req.body;
    const userId = req.user.id;

    const defaultSettings = {
      general: {
        siteName: 'Chicken Samosa Business',
        currency: 'BDT',
        deliveryCharge: 60,
        taxRate: 0,
        minOrderAmount: 50,
        maxOrderAmount: 10000,
        businessHours: '9:00 AM - 10:00 PM',
        timezone: 'Asia/Dhaka'
      },
      notification: {
        emailNotifications: true,
        smsNotifications: false,
        orderNotifications: true,
        reviewNotifications: true,
        marketingEmails: false
      },
      delivery: {
        deliveryRadius: 10,
        deliveryTime: '30-45 minutes',
        freeDeliveryThreshold: 500,
        deliveryAreas: []
      },
      security: {
        requireEmailVerification: true,
        requirePhoneVerification: false,
        maxLoginAttempts: 5,
        sessionTimeout: 24
      },
      payment: {
        bkash: { enabled: false, merchantNumber: '', apiKey: '' },
        nagad: { enabled: false, merchantNumber: '', apiKey: '' },
        rocket: { enabled: false, merchantNumber: '', apiKey: '' },
        upay: { enabled: false, merchantNumber: '', apiKey: '' },
        cashOnDelivery: { enabled: true, deliveryCharge: 60 }
      }
    };

    if (category && defaultSettings[category]) {
      // Reset specific category
      if (category === 'payment') {
        await Settings.savePaymentSettings(defaultSettings.payment, userId);
      } else {
        const updates = Object.entries(defaultSettings[category]).map(([key, value]) =>
          Settings.setSetting(category, key, value, userId)
        );
        await Promise.all(updates);
      }
    } else {
      // Reset all settings
      const allUpdates = [];
      Object.entries(defaultSettings).forEach(([settingCategory, settingValues]) => {
        if (settingCategory === 'payment') {
          allUpdates.push(Settings.savePaymentSettings(settingValues, userId));
        } else {
          Object.entries(settingValues).forEach(([key, value]) => {
            allUpdates.push(
              Settings.setSetting(settingCategory, key, value, userId)
            );
          });
        }
      });
      await Promise.all(allUpdates);
    }

    res.json({
      success: true,
      message: `Settings ${category ? `for ${category}` : ''} reset to defaults successfully`,
      category: category || 'all',
      resetBy: userId,
      resetAt: new Date()
    });
  } catch (error) {
    console.error('Reset settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ==================== REPORTS & ANALYTICS ====================

// Get comprehensive sales analytics
exports.getSalesAnalytics = async (req, res) => {
  try {
    const { period = '30d', startDate, endDate } = req.query;
    
    let dateFilter = {};
    const now = new Date();
    
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    } else {
      // Default period filters
      switch (period) {
        case '7d':
          dateFilter = {
            createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
          };
          break;
        case '30d':
          dateFilter = {
            createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }
          };
          break;
        case '90d':
          dateFilter = {
            createdAt: { $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) }
          };
          break;
        case '1y':
          dateFilter = {
            createdAt: { $gte: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) }
          };
          break;
      }
    }

    // Revenue analytics
    const revenueData = await Order.aggregate([
      { $match: { ...dateFilter, orderStatus: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$finalAmount' },
          totalOrders: { $sum: 1 },
          averageOrderValue: { $avg: '$finalAmount' },
          totalDeliveryCharge: { $sum: '$deliveryCharge' }
        }
      }
    ]);

    // Daily sales trend
    const dailySales = await Order.aggregate([
      { $match: { ...dateFilter, orderStatus: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          revenue: { $sum: '$finalAmount' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Product performance
    const productPerformance = await Order.aggregate([
      { $match: { ...dateFilter, orderStatus: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
          orderCount: { $sum: 1 }
        }
      },
      { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 }
    ]);

    // Payment method analytics
    const paymentMethods = await Order.aggregate([
      { $match: { ...dateFilter, orderStatus: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: '$paymentInfo.method',
          count: { $sum: 1 },
          totalAmount: { $sum: '$finalAmount' }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    // Order status distribution
    const orderStatusDistribution = await Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$orderStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$finalAmount' }
        }
      }
    ]);

    // Customer analytics
    const customerAnalytics = await Order.aggregate([
      { $match: { ...dateFilter, orderStatus: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: '$customer.email',
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$finalAmount' },
          lastOrder: { $max: '$createdAt' }
        }
      },
      {
        $group: {
          _id: null,
          totalCustomers: { $sum: 1 },
          repeatCustomers: { $sum: { $cond: [{ $gt: ['$totalOrders', 1] }, 1, 0] } },
          averageOrdersPerCustomer: { $avg: '$totalOrders' },
          averageCustomerValue: { $avg: '$totalSpent' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        revenue: revenueData[0] || { totalRevenue: 0, totalOrders: 0, averageOrderValue: 0, totalDeliveryCharge: 0 },
        dailySales,
        productPerformance,
        paymentMethods,
        orderStatusDistribution,
        customerAnalytics: customerAnalytics[0] || { totalCustomers: 0, repeatCustomers: 0, averageOrdersPerCustomer: 0, averageCustomerValue: 0 }
      }
    });
  } catch (error) {
    console.error('Sales analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch sales analytics' });
  }
};

// Get real-time dashboard metrics
exports.getDashboardMetrics = async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Today's metrics
    const todayMetrics = await Order.aggregate([
      { $match: { createdAt: { $gte: today }, orderStatus: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$finalAmount' },
          orders: { $sum: 1 },
          averageOrderValue: { $avg: '$finalAmount' }
        }
      }
    ]);

    // Yesterday's metrics for comparison
    const yesterdayMetrics = await Order.aggregate([
      { $match: { createdAt: { $gte: yesterday, $lt: today }, orderStatus: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$finalAmount' },
          orders: { $sum: 1 }
        }
      }
    ]);

    // This week's metrics
    const weekMetrics = await Order.aggregate([
      { $match: { createdAt: { $gte: thisWeek }, orderStatus: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$finalAmount' },
          orders: { $sum: 1 }
        }
      }
    ]);

    // This month's metrics
    const monthMetrics = await Order.aggregate([
      { $match: { createdAt: { $gte: thisMonth }, orderStatus: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$finalAmount' },
          orders: { $sum: 1 }
        }
      }
    ]);

    // Pending orders count
    const pendingOrders = await Order.countDocuments({ orderStatus: 'pending' });
    const processingOrders = await Order.countDocuments({ orderStatus: 'preparing' });
    const readyOrders = await Order.countDocuments({ orderStatus: 'ready' });
    const outForDeliveryOrders = await Order.countDocuments({ orderStatus: 'out_for_delivery' });

    // Recent orders (last 10)
    const recentOrders = await Order.find({ orderStatus: { $ne: 'cancelled' } })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('orderNumber customer.name finalAmount orderStatus createdAt')
      .lean();

    res.json({
      success: true,
      data: {
        today: todayMetrics[0] || { revenue: 0, orders: 0, averageOrderValue: 0 },
        yesterday: yesterdayMetrics[0] || { revenue: 0, orders: 0 },
        week: weekMetrics[0] || { revenue: 0, orders: 0 },
        month: monthMetrics[0] || { revenue: 0, orders: 0 },
        orderStatus: {
          pending: pendingOrders,
          processing: processingOrders,
          ready: readyOrders,
          outForDelivery: outForDeliveryOrders
        },
        recentOrders
      }
    });
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard metrics' });
  }
};

// Generate and download report
exports.generateReport = async (req, res) => {
  try {
    const { type = 'sales', format = 'json', startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    }

    let reportData = {};

    switch (type) {
      case 'sales':
        reportData = await generateSalesReport(dateFilter);
        break;
      case 'products':
        reportData = await generateProductReport(dateFilter);
        break;
      case 'customers':
        reportData = await generateCustomerReport(dateFilter);
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid report type' });
    }

    if (format === 'csv') {
      // Generate CSV
      const csv = generateCSV(reportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${type}_report_${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csv);
    } else if (format === 'pdf') {
      // Generate PDF (you would need a PDF library like puppeteer or jsPDF)
      // For now, return JSON
      res.json({ success: true, data: reportData });
    } else {
      res.json({ success: true, data: reportData });
    }
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
};

// Helper functions for report generation
async function generateSalesReport(dateFilter) {
  const salesData = await Order.aggregate([
    { $match: { ...dateFilter, orderStatus: { $ne: 'cancelled' } } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        revenue: { $sum: '$finalAmount' },
        orders: { $sum: 1 },
        averageOrderValue: { $avg: '$finalAmount' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
  ]);

  return {
    type: 'sales',
    generatedAt: new Date(),
    data: salesData
  };
}

async function generateProductReport(dateFilter) {
  const productData = await Order.aggregate([
    { $match: { ...dateFilter, orderStatus: { $ne: 'cancelled' } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        totalQuantity: { $sum: '$items.quantity' },
        totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
        orderCount: { $sum: 1 }
      }
    },
    { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
    { $sort: { totalRevenue: -1 } }
  ]);

  return {
    type: 'products',
    generatedAt: new Date(),
    data: productData
  };
}

async function generateCustomerReport(dateFilter) {
  const customerData = await Order.aggregate([
    { $match: { ...dateFilter, orderStatus: { $ne: 'cancelled' } } },
    {
      $group: {
        _id: '$customer.email',
        customerName: { $first: '$customer.name' },
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: '$finalAmount' },
        averageOrderValue: { $avg: '$finalAmount' },
        firstOrder: { $min: '$createdAt' },
        lastOrder: { $max: '$createdAt' }
      }
    },
    { $sort: { totalSpent: -1 } }
  ]);

  return {
    type: 'customers',
    generatedAt: new Date(),
    data: customerData
  };
}

function generateCSV(data) {
  // Simple CSV generation
  if (!data.data || data.data.length === 0) return '';
  
  const headers = Object.keys(data.data[0]).join(',');
  const rows = data.data.map(row => 
    Object.values(row).map(value => 
      typeof value === 'object' ? JSON.stringify(value) : value
    ).join(',')
  );
  
  return [headers, ...rows].join('\n');
}

// ==================== EMAIL REPORTS ====================

// Send manual reports
exports.sendDailyReport = async (req, res) => {
  try {
    const { recipients } = req.body;
    const schedulerService = require('../services/schedulerService');
    
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Recipients array is required' 
      });
    }

    await schedulerService.sendDailyReportNow(recipients);
    
    res.json({
      success: true,
      message: 'Daily report sent successfully'
    });
  } catch (error) {
    console.error('Send daily report error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send daily report' 
    });
  }
};

exports.sendWeeklyReport = async (req, res) => {
  try {
    const { recipients } = req.body;
    const schedulerService = require('../services/schedulerService');
    
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Recipients array is required' 
      });
    }

    await schedulerService.sendWeeklyReportNow(recipients);
    
    res.json({
      success: true,
      message: 'Weekly report sent successfully'
    });
  } catch (error) {
    console.error('Send weekly report error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send weekly report' 
    });
  }
};

exports.sendMonthlyReport = async (req, res) => {
  try {
    const { recipients } = req.body;
    const schedulerService = require('../services/schedulerService');
    
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Recipients array is required' 
      });
    }

    await schedulerService.sendMonthlyReportNow(recipients);
    
    res.json({
      success: true,
      message: 'Monthly report sent successfully'
    });
  } catch (error) {
    console.error('Send monthly report error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send monthly report' 
    });
  }
};

// Scheduler management
exports.getSchedulerStatus = async (req, res) => {
  try {
    let schedulerService, emailReportService;
    
    try {
      schedulerService = require('../services/schedulerService');
    } catch (error) {
      console.error('Scheduler service not available:', error.message);
    }
    
    try {
      emailReportService = require('../services/emailReportService');
    } catch (error) {
      console.error('Email service not available:', error.message);
    }
    
    const status = schedulerService ? schedulerService.getStatus() : {
      isRunning: false,
      jobs: {},
      error: 'Scheduler service not available'
    };
    
    // Use the same logic as the public endpoint for consistency
    const emailServiceStatus = {
      initialized: !!(emailReportService && emailReportService.transporter),
      hasCredentials: !!(process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_SECRET || process.env.GMAIL_APP_PASSWORD),
      available: !!emailReportService,
      hasOAuth2: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN),
      hasAppPassword: !!(process.env.GMAIL_APP_PASSWORD && process.env.GMAIL_USER),
      hasServiceAccount: (() => {
        try {
          return require('fs').existsSync(require('path').join(__dirname, '../google-credentials.json'));
        } catch (error) {
          return false;
        }
      })()
    };
    
    res.json({
      success: true,
      data: {
        ...status,
        emailService: emailServiceStatus
      }
    });
  } catch (error) {
    console.error('Get scheduler status error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get scheduler status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.updateSchedule = async (req, res) => {
  try {
    const { jobName, cronExpression } = req.body;
    const schedulerService = require('../services/schedulerService');
    
    if (!jobName || !cronExpression) {
      return res.status(400).json({ 
        success: false, 
        message: 'Job name and cron expression are required' 
      });
    }

    schedulerService.updateSchedule(jobName, cronExpression);
    
    res.json({
      success: true,
      message: 'Schedule updated successfully'
    });
  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update schedule' 
    });
  }
};

exports.startScheduler = async (req, res) => {
  try {
    const schedulerService = require('../services/schedulerService');
    await schedulerService.start();
    
    res.json({
      success: true,
      message: 'Scheduler started successfully'
    });
  } catch (error) {
    console.error('Start scheduler error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to start scheduler' 
    });
  }
};

exports.stopScheduler = async (req, res) => {
  try {
    const schedulerService = require('../services/schedulerService');
    schedulerService.stop();
    
    res.json({
      success: true,
      message: 'Scheduler stopped successfully'
    });
  } catch (error) {
    console.error('Stop scheduler error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to stop scheduler' 
    });
  }
};

// Test email service
exports.testEmailService = async (req, res) => {
  try {
    const emailReportService = require('../services/emailReportService');
    
    // Check if email service is available
    if (!emailReportService) {
      return res.status(500).json({
        success: false,
        message: 'Email service not available',
        error: 'EmailReportService could not be loaded'
      });
    }
    
    if (!emailReportService.transporter) {
      return res.status(400).json({
        success: false,
        message: 'Email service not initialized. Please check your email credentials.',
        details: {
          hasOAuth2: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN),
          hasAppPassword: !!(process.env.GMAIL_APP_PASSWORD && process.env.GMAIL_USER),
          hasServiceAccount: require('fs').existsSync(require('path').join(__dirname, '../google-credentials.json')),
          transporterExists: !!emailReportService.transporter
        }
      });
    }

    // Test with a simple email
    const testRecipients = [process.env.GMAIL_USER || 'test@example.com'];
    
    try {
      await emailReportService.sendDailyReport(testRecipients);
      res.json({
        success: true,
        message: 'Test email sent successfully! Check your inbox.',
        recipients: testRecipients
      });
    } catch (emailError) {
      res.status(500).json({
        success: false,
        message: 'Failed to send test email',
        error: emailError.message,
        details: {
          errorType: emailError.constructor.name,
          stack: process.env.NODE_ENV === 'development' ? emailError.stack : undefined
        }
      });
    }
  } catch (error) {
    console.error('Test email service error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test email service',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      details: {
        errorType: error.constructor.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
};