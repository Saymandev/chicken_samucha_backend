const { validationResult } = require('express-validator');
const Coupon = require('../models/Coupon');
const Product = require('../models/Product');

// Create coupon (Admin only)
const createCoupon = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const couponData = req.body;
    
    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({ code: couponData.code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code already exists'
      });
    }

    // Convert code to uppercase
    couponData.code = couponData.code.toUpperCase();

    const coupon = await Coupon.create(couponData);

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      coupon
    });
  } catch (error) {
    console.error('Create coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get all coupons (Admin only)
const getAllCoupons = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'all', search } = req.query;
    
    let query = {};
    
    // Status filter
    if (status === 'active') {
      query.isActive = true;
      query.validUntil = { $gte: new Date() };
    } else if (status === 'expired') {
      query.validUntil = { $lt: new Date() };
    } else if (status === 'inactive') {
      query.isActive = false;
    }
    
    // Search functionality
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { 'name.en': { $regex: search, $options: 'i' } },
        { 'name.bn': { $regex: search, $options: 'i' } },
        { 'description.en': { $regex: search, $options: 'i' } },
        { 'description.bn': { $regex: search, $options: 'i' } }
      ];
    }

    const coupons = await Coupon.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('applicableProducts', 'name');

    const total = await Coupon.countDocuments(query);

    res.json({
      success: true,
      count: coupons.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      coupons
    });
  } catch (error) {
    console.error('Get all coupons error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get single coupon
const getCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id)
      .populate('applicableProducts', 'name');

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    res.json({
      success: true,
      coupon
    });
  } catch (error) {
    console.error('Get coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Update coupon (Admin only)
const updateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    const updateData = req.body;
    
    // If code is being updated, check for duplicates
    if (updateData.code && updateData.code !== coupon.code) {
      const existingCoupon = await Coupon.findOne({ 
        code: updateData.code.toUpperCase(),
        _id: { $ne: req.params.id }
      });
      if (existingCoupon) {
        return res.status(400).json({
          success: false,
          message: 'Coupon code already exists'
        });
      }
      updateData.code = updateData.code.toUpperCase();
    }

    Object.assign(coupon, updateData);
    await coupon.save();

    res.json({
      success: true,
      message: 'Coupon updated successfully',
      coupon
    });
  } catch (error) {
    console.error('Update coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Delete coupon (Admin only)
const deleteCoupon = async (req, res) => {
  try {
   
    
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      
    }

  
    await Coupon.findByIdAndDelete(req.params.id);
   

    res.json({
      success: true,
      message: 'Coupon deleted successfully'
    });
  } catch (error) {
    console.error('Delete coupon error:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Validate coupon
const validateCoupon = async (req, res) => {
  try {
    const { code, orderAmount, userId, orderProducts } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code is required'
      });
    }

    const coupon = await Coupon.findOne({ 
      code: code.toUpperCase(),
      isActive: true 
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid coupon code'
      });
    }

    // Check if coupon is valid
    if (!coupon.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'Coupon has expired or is no longer valid'
      });
    }

    // Check if coupon is applicable to order
    if (!(await coupon.isApplicableToOrder(orderAmount, userId, orderProducts))) {
      return res.status(400).json({
        success: false,
        message: 'Coupon is not applicable to this order'
      });
    }

    // Calculate discount
    const discount = coupon.calculateDiscount(orderAmount);

    res.json({
      success: true,
      message: 'Coupon is valid',
      coupon: {
        id: coupon._id,
        code: coupon.code,
        name: coupon.name,
        type: coupon.type,
        value: coupon.value,
        discount: discount,
        maxDiscountAmount: coupon.maxDiscountAmount
      }
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Apply coupon
const applyCoupon = async (req, res) => {
  try {
    const { code, orderAmount, userId, orderProducts } = req.body;

    const coupon = await Coupon.findOne({ 
      code: code.toUpperCase(),
      isActive: true 
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid coupon code'
      });
    }

    if (!coupon.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'Coupon has expired or is no longer valid'
      });
    }

    if (!(await coupon.isApplicableToOrder(orderAmount, userId, orderProducts))) {
      return res.status(400).json({
        success: false,
        message: 'Coupon is not applicable to this order'
      });
    }

    // Increment usage count
    await Coupon.findByIdAndUpdate(coupon._id, {
      $inc: { usedCount: 1 }
    });

    const discount = coupon.calculateDiscount(orderAmount);

    res.json({
      success: true,
      message: 'Coupon applied successfully',
      coupon: {
        id: coupon._id,
        code: coupon.code,
        name: coupon.name,
        type: coupon.type,
        value: coupon.value,
        discount: discount,
        maxDiscountAmount: coupon.maxDiscountAmount
      }
    });
  } catch (error) {
    console.error('Apply coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get active coupons (Public)
const getActiveCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find({
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() },
      $or: [
        { usageLimit: null },
        { $expr: { $lt: ['$usedCount', '$usageLimit'] } }
      ]
    })
    .select('code name description type value minOrderAmount maxDiscountAmount validUntil')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: coupons.length,
      coupons
    });
  } catch (error) {
    console.error('Get active coupons error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  createCoupon,
  getAllCoupons,
  getCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  applyCoupon,
  getActiveCoupons
};