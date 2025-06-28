const { validationResult } = require('express-validator');
const Review = require('../models/Review');
const Order = require('../models/Order');
const { deleteImage } = require('../middleware/upload');
const Product = require('../models/Product');

// Get all reviews (public)
const getReviews = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      rating, 
      search, 
      sortBy = 'newest',
      productId 
    } = req.query;

    const query = { 
      status: 'approved',
      isVisible: true 
    };

    if (rating) {
      query.rating = parseInt(rating);
    }

    if (search) {
      query.$or = [
        { 'comment.en': { $regex: search, $options: 'i' } },
        { 'comment.bn': { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } }
      ];
    }

    if (productId) {
      query.product = productId;
    }

    let sortOptions = {};
    switch (sortBy) {
      case 'oldest':
        sortOptions = { createdAt: 1 };
        break;
      case 'highest':
        sortOptions = { rating: -1, createdAt: -1 };
        break;
      case 'lowest':
        sortOptions = { rating: 1, createdAt: -1 };
        break;
      default: // newest
        sortOptions = { createdAt: -1 };
    }

    const reviews = await Review.find(query)
      .populate('product', 'name')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: reviews,
      totalPages,
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get featured reviews
const getFeaturedReviews = async (req, res) => {
  try {
    const reviews = await Review.find({
      status: 'approved',
      isFeatured: true,
      isVisible: true
    })
      .populate('product', 'name')
      .sort({ createdAt: -1 })
      .limit(6);

    res.json({
      success: true,
      data: reviews
    });
  } catch (error) {
    console.error('Get featured reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Create review
const createReview = async (req, res) => {
  try {
    console.log('=== CREATE REVIEW DEBUG ===');
    console.log('Request body:', req.body);
    console.log('Request files:', req.files);
    console.log('User:', req.user ? req.user.id : 'No user');
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Handle flat field structure from form data
    const customerName = req.body['customer.name'];
    const customerEmail = req.body['customer.email'];
    const customerPhone = req.body['customer.phone'];
    const product = req.body.product;
    const rating = req.body.rating;
    const commentEn = req.body['comment.en'];
    const commentBn = req.body['comment.bn'];

    console.log('Parsed fields:', {
      customerName,
      customerEmail,
      customerPhone,
      product,
      rating,
      commentEn,
      commentBn
    });

    let productId = null;
    
    // Handle product - can be either ObjectId or product name
    if (product) {
      // Check if it's a valid ObjectId format (24 character hex string)
      if (/^[0-9a-fA-F]{24}$/.test(product)) {
        productId = product;
      } else {
        // It's a product name, try to find the product
        const foundProduct = await Product.findOne({
          $or: [
            { 'name.en': { $regex: product, $options: 'i' } },
            { 'name.bn': { $regex: product, $options: 'i' } }
          ]
        });
        
        if (foundProduct) {
          productId = foundProduct._id;
          console.log(`Found product: ${foundProduct.name.en} (ID: ${productId})`);
        } else {
          // Product not found, we'll create a general review without specific product
          console.log(`Product "${product}" not found, creating general review`);
        }
      }
    }

    // Check if user already reviewed this product (only if we have a valid product)
    if (req.user && productId) {
      const existingReview = await Review.findOne({
        user: req.user.id,
        product: productId
      });

      if (existingReview) {
        return res.status(400).json({
          success: false,
          message: 'You have already reviewed this product'
        });
      }
    }

    const reviewData = {
      user: req.user ? req.user.id : null,
      customer: {
        name: customerName,
        email: customerEmail || '',
        phone: customerPhone || ''
      },
      product: productId, // Will be null if product not found
      rating: parseInt(rating),
      comment: {
        en: commentEn,
        bn: commentBn || ''
      },
      status: 'pending', // Reviews need approval
      isVisible: false,
      // Store the original product name if we couldn't find the product
      originalProductName: productId ? undefined : product
    };

    console.log('Final review data:', reviewData);

    // Handle uploaded images
    if (req.files && req.files.length > 0) {
      reviewData.images = req.files.map(file => ({
        url: file.path,
        public_id: file.filename
      }));
    }

    const review = await Review.create(reviewData);

    // Update product rating
    await updateProductRating(product);

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully. It will be published after approval.',
      data: review
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get all reviews (admin)
const getAllReviews = async (req, res) => {
  try {
    console.log('=== GET ALL REVIEWS (ADMIN) ===');
    console.log('Query params:', req.query);
    console.log('User:', req.user ? req.user.id : 'No user');

    const { 
      page = 1, 
      limit = 20, 
      status, 
      rating,
      search
    } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }

    if (rating) {
      query.rating = parseInt(rating);
    }

    if (search) {
      query.$or = [
        { 'comment.en': { $regex: search, $options: 'i' } },
        { 'comment.bn': { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } }
      ];
    }

    console.log('Final query:', query);

    const reviews = await Review.find(query)
      .populate('product', 'name')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments(query);

    console.log(`Found ${reviews.length} reviews, total: ${total}`);

    res.json({
      success: true,
      data: reviews,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get all reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get single review (admin)
const getReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('product', 'name')
      .populate('user', 'name email');

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    console.error('Get review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Update review status (admin)
const updateReviewStatus = async (req, res) => {
  try {
    const { status, isFeatured } = req.body;

    const updateData = {};
    if (status !== undefined) {
      updateData.status = status;
      updateData.moderatedBy = req.user.id;
      updateData.moderatedAt = new Date();
    }
    if (isFeatured !== undefined) {
      updateData.isFeatured = Boolean(isFeatured);
    }

    const review = await Review.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Update product rating if status changed to approved
    if (status === 'approved' && review.product) {
      await updateProductRating(review.product);
    }

    // Update visibility based on status
    if (status) {
      review.isVisible = status === 'approved';
      await review.save();
    }

    res.json({
      success: true,
      message: 'Review updated successfully',
      data: review
    });
  } catch (error) {
    console.error('Update review status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Add admin response to review
const addAdminResponse = async (req, res) => {
  try {
    const { response } = req.body;

    const review = await Review.findByIdAndUpdate(
      req.params.id,
      {
        adminResponse: {
          message: { en: response },
          respondedBy: req.user.id,
          respondedAt: new Date()
        }
      },
      { new: true }
    ).populate('adminResponse.respondedBy', 'name');

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.json({
      success: true,
      message: 'Admin response added successfully',
      data: review
    });
  } catch (error) {
    console.error('Add admin response error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Delete review (admin)
const deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Actually delete the review
    await Review.findByIdAndDelete(req.params.id);

    // Update product rating if the review was approved
    if (review.status === 'approved' && review.product) {
      await updateProductRating(review.product);
    }

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Helper function to update product rating
const updateProductRating = async (productId) => {
  try {
    const reviews = await Review.find({
      product: productId,
      status: 'approved',
      isVisible: true
    });

    if (reviews.length === 0) {
      await Product.findByIdAndUpdate(productId, {
        'ratings.average': 0,
        'ratings.count': 0
      });
      return;
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;

    await Product.findByIdAndUpdate(productId, {
      'ratings.average': Math.round(averageRating * 10) / 10, // Round to 1 decimal
      'ratings.count': reviews.length
    });
  } catch (error) {
    console.error('Update product rating error:', error);
  }
};

module.exports = {
  getReviews,
  getFeaturedReviews,
  createReview,
  getAllReviews,
  getReview,
  updateReviewStatus,
  addAdminResponse,
  deleteReview
}; 