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
    const settings = {
      general: {
        siteName: 'Chicken Samosa Business',
        currency: 'BDT',
        deliveryCharge: 60,
        taxRate: 0,
        minOrderAmount: 50
      },
      notifications: {
        emailNotifications: true,
        smsNotifications: false,
        orderNotifications: true,
        reviewNotifications: true
      },
      payment: {
        bkashEnabled: true,
        nagadEnabled: true,
        rocketEnabled: true,
        upayEnabled: true,
        cashOnDeliveryEnabled: true
      }
    };

    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch system settings' });
  }
};

// Update system settings
exports.updateSystemSettings = async (req, res) => {
  try {
    // In a real application, you would save these to a database
    // For now, just return success
    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: req.body
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update system settings' });
  }
};
