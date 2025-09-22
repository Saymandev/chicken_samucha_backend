const express = require('express');
const adminController = require('../controllers/adminController');
const notificationController = require('../controllers/notificationController');
const { protect, authorize } = require('../middleware/auth');
const { body } = require('express-validator');
const productController = require('../controllers/productController');
const { upload } = require('../middleware/upload');

const router = express.Router();

// Apply admin authentication to all routes
router.use(protect);
router.use(authorize('admin'));

// Dashboard routes
router.get('/dashboard/recent-activities', adminController.getRecentActivities);

// User management
router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUser);
router.put('/users/:userId/status', adminController.updateUserStatus);
router.put('/users/:userId/role', adminController.updateUserRole);
router.delete('/users/:userId', adminController.deleteUser);

// Order management
router.get('/orders', adminController.getAllOrders);
router.put('/orders/:orderId/status', adminController.updateOrderStatus);
router.put('/orders/:orderId/verify-payment', adminController.verifyPayment);

// Product management
router.get('/products', async (req, res) => {
  // Get all products for admin (including hidden ones)
  try {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      sort = '-createdAt'
    } = req.query;

    const query = {};

    // Search functionality
    if (search) {
      query.$or = [
        { 'name.en': { $regex: search, $options: 'i' } },
        { 'name.bn': { $regex: search, $options: 'i' } },
        { 'description.en': { $regex: search, $options: 'i' } },
        { 'description.bn': { $regex: search, $options: 'i' } }
      ];
    }

    // Category filter - use category ID instead of name
    if (category && category !== 'all') {
      query.category = category;
    }

    const Product = require('../models/Product');
    
    // Parse sort parameter
    let sortOptions = {};
    if (sort.startsWith('-')) {
      sortOptions[sort.substring(1)] = -1;
    } else {
      sortOptions[sort] = 1;
    }
    
    const products = await Product.find(query)
      .populate('category', 'name slug')
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .select('-__v');

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      products,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });
  } catch (error) {
    console.error('Admin get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

router.post('/products', 
  (req, res, next) => {
    next();
  },
  upload.productImages.array('images', 5),
  (req, res, next) => {
    
    next();
  },
  [
    body('name').custom((value) => {
      try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        if (!parsed.en) {
          throw new Error('English name is required');
        }
        // Auto-fill Bengali if missing
        if (!parsed.bn) {
          parsed.bn = parsed.en;
        }
        return true;
      } catch (e) {
        throw new Error('Invalid name format');
      }
    }),
    body('description').custom((value) => {
      try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        if (!parsed.en) {
          throw new Error('English description is required');
        }
        // Auto-fill Bengali if missing
        if (!parsed.bn) {
          parsed.bn = parsed.en;
        }
        return true;
      } catch (e) {
        throw new Error('Invalid description format');
      }
    }),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number')
  ],
  productController.createProduct
);

router.put('/products/:id', 
  upload.productImages.array('images', 5),
  productController.updateProduct
);

router.delete('/products/:id', productController.deleteProduct);

// Review management routes
const reviewController = require('../controllers/reviewController');

router.get('/reviews', (req, res, next) => {
  
  next();
}, reviewController.getAllReviews);

router.get('/reviews/:id', reviewController.getReview);
router.put('/reviews/:id/status', reviewController.updateReviewStatus);
router.put('/reviews/:id/response', reviewController.addAdminResponse);
router.delete('/reviews/:id', reviewController.deleteReview);

// Debug route to test file uploads
router.post('/test-upload', 
  (req, res, next) => {
    
    next();
  },
  upload.productImages.array('images', 5),
  (req, res) => {
    
    
    res.json({
      success: true,
      message: 'Upload test successful',
      filesReceived: req.files ? req.files.length : 0,
      bodyReceived: req.body
    });
  }
);

// Content management
router.get('/content/hero', adminController.getHeroContent);
router.put('/content/hero', adminController.updateHeroContent);
router.get('/content/slider', adminController.getSliderItems);
router.put('/content/slider/:itemId/toggle', adminController.toggleSliderItem);

// Payment settings
router.get('/settings/payments', adminController.getPaymentSettings);
router.put('/settings/payments', adminController.updatePaymentSettings);

// System settings
router.get('/settings', adminController.getSystemSettings);
router.get('/settings/:category', adminController.getSettingsByCategory);
router.put('/settings', adminController.updateSystemSettings);
router.post('/settings/reset', adminController.resetSettingsToDefaults);

// Dashboard statistics
router.get('/dashboard/stats', adminController.getDashboardStats);

// Notification management
router.get('/notifications', notificationController.getNotifications);
router.get('/notifications/stats', notificationController.getNotificationStats);
router.get('/notifications/:id', notificationController.getNotification);
router.post('/notifications', notificationController.createNotification);
router.put('/notifications/:id/read', notificationController.markAsRead);
router.put('/notifications/mark-all-read', notificationController.markAllAsRead);
router.delete('/notifications/:id', notificationController.deleteNotification);

// Campaigns (email broadcasts)
const campaignController = require('../controllers/campaignController');
router.post('/campaigns', campaignController.create);
router.get('/campaigns', campaignController.list);
router.post('/campaigns/:id/send', campaignController.sendNow);
router.delete('/campaigns/:id', campaignController.remove);

// Reports & Analytics
router.get('/reports/sales-analytics', adminController.getSalesAnalytics);
router.get('/reports/dashboard-metrics', adminController.getDashboardMetrics);
router.get('/reports/generate', adminController.generateReport);

// Email Reports
router.post('/reports/send-daily', adminController.sendDailyReport);
router.post('/reports/send-weekly', adminController.sendWeeklyReport);
router.post('/reports/send-monthly', adminController.sendMonthlyReport);

// Scheduler Management
router.get('/scheduler/status', adminController.getSchedulerStatus);
router.post('/scheduler/start', adminController.startScheduler);
router.post('/scheduler/stop', adminController.stopScheduler);
router.put('/scheduler/update', adminController.updateSchedule);

// Email Service Testing
router.post('/email/test', adminController.testEmailService);

// Scheduler Testing
router.get('/scheduler/test', adminController.testScheduler);

module.exports = router; 