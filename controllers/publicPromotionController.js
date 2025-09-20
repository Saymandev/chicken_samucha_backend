const Promotion = require('../models/Promotion');

// @desc    Get active promotions (Public)
// @route   GET /api/promotions
// @access  Public
exports.getActivePromotions = async (req, res) => {
  try {
    const {
      type,
      targetAudience = 'all',
      limit = 5,
      page = 'homepage' // homepage, product, cart, checkout
    } = req.query;

    // Build query for active promotions
    const now = new Date();
    let query = {
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now }
    };

    // Filter by type if specified
    if (type) {
      query.type = type;
    }

    // Filter by target audience
    query.$or = [
      { targetAudience: 'all' },
      { targetAudience }
    ];

    // Filter by display rules based on page
    if (page === 'homepage') {
      query['displayRules.showOnHomepage'] = true;
    } else if (page === 'product') {
      query['displayRules.showOnProductPage'] = true;
    } else if (page === 'cart') {
      query['displayRules.showOnCartPage'] = true;
    } else if (page === 'checkout') {
      query['displayRules.showOnCheckout'] = true;
    }

    const promotions = await Promotion.find(query)
      .sort({ priority: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .select('title description shortDescription image bannerImage type discountType discountValue validUntil displayFrequency ctaButton displayRules priority targetAudience metadata');

    // Add time remaining to each promotion
    const promotionsWithTimeRemaining = promotions.map(promotion => ({
      ...promotion.toObject(),
      timeRemaining: promotion.timeRemaining,
      isValid: promotion.isValid
    }));

    res.json({
      success: true,
      promotions: promotionsWithTimeRemaining,
      count: promotions.length
    });
  } catch (error) {
    console.error('Get active promotions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Track promotion view (Public)
// @route   POST /api/promotions/:id/view
// @access  Public
exports.trackPromotionView = async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    // Increment view count
    await promotion.incrementView();

    res.json({
      success: true,
      message: 'View tracked successfully'
    });
  } catch (error) {
    console.error('Track promotion view error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Track promotion click (Public)
// @route   POST /api/promotions/:id/click
// @access  Public
exports.trackPromotionClick = async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    // Increment click count
    await promotion.incrementClick();

    res.json({
      success: true,
      message: 'Click tracked successfully'
    });
  } catch (error) {
    console.error('Track promotion click error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Track promotion conversion (Public)
// @route   POST /api/promotions/:id/conversion
// @access  Public
exports.trackPromotionConversion = async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    // Increment conversion count
    await promotion.incrementConversion();

    res.json({
      success: true,
      message: 'Conversion tracked successfully'
    });
  } catch (error) {
    console.error('Track promotion conversion error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get promotion by ID (Public)
// @route   GET /api/promotions/:id
// @access  Public
exports.getPromotionById = async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    // Check if promotion is active and valid
    if (!promotion.isValid) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not available'
      });
    }

    // Track view
    await promotion.incrementView();

    res.json({
      success: true,
      promotion: {
        ...promotion.toObject(),
        timeRemaining: promotion.timeRemaining,
        isValid: promotion.isValid
      }
    });
  } catch (error) {
    console.error('Get promotion by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
