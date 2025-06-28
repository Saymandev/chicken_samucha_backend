const express = require('express');
const adminController = require('../controllers/adminController');
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

    // Category filter
    if (category && category !== 'all') {
      query.$or = [
        { 'category.en': { $regex: category, $options: 'i' } },
        { 'category.bn': { $regex: category, $options: 'i' } }
      ];
    }

    const Product = require('../models/Product');
    
    const products = await Product.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-__v');

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      products,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / limit),
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
    console.log('=== MIDDLEWARE DEBUG ===');
    console.log('Request Content-Type:', req.get('Content-Type'));
    console.log('Request headers:', req.headers);
    console.log('Request body type:', typeof req.body);
    console.log('Request files before multer:', req.files);
    next();
  },
  upload.productImages.array('images', 5),
  (req, res, next) => {
    console.log('=== AFTER MULTER ===');
    console.log('Request files after multer:', req.files);
    console.log('Request body after multer:', req.body);
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
  console.log('=== ADMIN REVIEWS ROUTE HIT ===');
  console.log('Query:', req.query);
  console.log('User:', req.user ? req.user.email : 'No user');
  next();
}, reviewController.getAllReviews);

router.get('/reviews/:id', reviewController.getReview);
router.put('/reviews/:id/status', reviewController.updateReviewStatus);
router.put('/reviews/:id/response', reviewController.addAdminResponse);
router.delete('/reviews/:id', reviewController.deleteReview);

// Debug route to test file uploads
router.post('/test-upload', 
  (req, res, next) => {
    console.log('=== TEST UPLOAD DEBUG ===');
    console.log('Content-Type:', req.get('Content-Type'));
    console.log('Body:', req.body);
    console.log('Files before multer:', req.files);
    next();
  },
  upload.productImages.array('images', 5),
  (req, res) => {
    console.log('=== TEST UPLOAD RESULT ===');
    console.log('Files after multer:', req.files);
    console.log('Body after multer:', req.body);
    
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
router.put('/settings', adminController.updateSystemSettings);

// Dashboard statistics
router.get('/dashboard/stats', adminController.getDashboardStats);

module.exports = router; 