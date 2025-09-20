const { validationResult } = require('express-validator');
const Promotion = require('../models/Promotion');
const { deleteImage } = require('../middleware/upload');

// @desc    Get all promotions (Admin)
// @route   GET /api/admin/promotions
// @access  Private (Admin)
exports.getAllPromotions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      type,
      status = 'all' // all, active, expired, upcoming
    } = req.query;

    // Build query
    const query = {};
    
    if (search) {
      query.$or = [
        { 'title.en': { $regex: search, $options: 'i' } },
        { 'title.bn': { $regex: search, $options: 'i' } },
        { 'description.en': { $regex: search, $options: 'i' } }
      ];
    }

    if (type) {
      query.type = type;
    }

    // Filter by status
    const now = new Date();
    if (status === 'active') {
      query.isActive = true;
      query.validFrom = { $lte: now };
      query.validUntil = { $gte: now };
    } else if (status === 'expired') {
      query.validUntil = { $lt: now };
    } else if (status === 'upcoming') {
      query.validFrom = { $gt: now };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    const total = await Promotion.countDocuments(query);

    const promotions = await Promotion.find(query)
      .sort({ priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      promotions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get promotions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get single promotion (Admin)
// @route   GET /api/admin/promotions/:id
// @access  Private (Admin)
exports.getPromotion = async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id);

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    res.json({
      success: true,
      promotion
    });
  } catch (error) {
    console.error('Get promotion error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Create new promotion (Admin)
// @route   POST /api/admin/promotions
// @access  Private (Admin)
exports.createPromotion = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const promotionData = req.body;
    
    // Handle image uploads
    if (req.files) {
      if (req.files.image) {
        promotionData.image = {
          url: req.files.image[0].path,
          public_id: req.files.image[0].filename
        };
      }
      if (req.files.bannerImage) {
        promotionData.bannerImage = {
          url: req.files.bannerImage[0].path,
          public_id: req.files.bannerImage[0].filename
        };
      }
    }

    const promotion = await Promotion.create(promotionData);

    res.status(201).json({
      success: true,
      message: 'Promotion created successfully',
      promotion
    });
  } catch (error) {
    console.error('Create promotion error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update promotion (Admin)
// @route   PUT /api/admin/promotions/:id
// @access  Private (Admin)
exports.updatePromotion = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    const updateData = req.body;

    // Handle image updates
    if (req.files) {
      // Delete old images if new ones are uploaded
      if (req.files.image) {
        if (promotion.image && promotion.image.public_id) {
          await deleteImage(promotion.image.public_id);
        }
        updateData.image = {
          url: req.files.image[0].path,
          public_id: req.files.image[0].filename
        };
      }
      if (req.files.bannerImage) {
        if (promotion.bannerImage && promotion.bannerImage.public_id) {
          await deleteImage(promotion.bannerImage.public_id);
        }
        updateData.bannerImage = {
          url: req.files.bannerImage[0].path,
          public_id: req.files.bannerImage[0].filename
        };
      }
    }

    const updatedPromotion = await Promotion.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Promotion updated successfully',
      promotion: updatedPromotion
    });
  } catch (error) {
    console.error('Update promotion error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete promotion (Admin)
// @route   DELETE /api/admin/promotions/:id
// @access  Private (Admin)
exports.deletePromotion = async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    // Delete associated images
    if (promotion.image && promotion.image.public_id) {
      await deleteImage(promotion.image.public_id);
    }
    if (promotion.bannerImage && promotion.bannerImage.public_id) {
      await deleteImage(promotion.bannerImage.public_id);
    }

    await Promotion.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Promotion deleted successfully'
    });
  } catch (error) {
    console.error('Delete promotion error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Toggle promotion status (Admin)
// @route   PUT /api/admin/promotions/:id/toggle
// @access  Private (Admin)
exports.togglePromotionStatus = async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    promotion.isActive = !promotion.isActive;
    await promotion.save();

    res.json({
      success: true,
      message: `Promotion ${promotion.isActive ? 'activated' : 'deactivated'} successfully`,
      promotion
    });
  } catch (error) {
    console.error('Toggle promotion status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get promotion analytics (Admin)
// @route   GET /api/admin/promotions/:id/analytics
// @access  Private (Admin)
exports.getPromotionAnalytics = async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    const analytics = {
      views: promotion.analytics.views,
      clicks: promotion.analytics.clicks,
      conversions: promotion.analytics.conversions,
      clickThroughRate: promotion.analytics.views > 0 ? 
        (promotion.analytics.clicks / promotion.analytics.views * 100).toFixed(2) : 0,
      conversionRate: promotion.analytics.clicks > 0 ? 
        (promotion.analytics.conversions / promotion.analytics.clicks * 100).toFixed(2) : 0,
      timeRemaining: promotion.timeRemaining,
      isValid: promotion.isValid
    };

    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Get promotion analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
