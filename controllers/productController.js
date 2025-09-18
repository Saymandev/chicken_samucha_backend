const { validationResult } = require('express-validator');
const Product = require('../models/Product');
const { deleteImage } = require('../middleware/upload');

// Get all products (public)
const getProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      minPrice,
      maxPrice,
      sortBy = 'displayOrder',
      sortOrder = 'asc',
      language = 'en',
      filter
    } = req.query;

    // Build query
    const query = { 
      isVisible: true, 
      isAvailable: true 
    };

    // Search functionality
    if (search) {
      query.$or = [
        { [`name.${language}`]: { $regex: search, $options: 'i' } },
        { [`description.${language}`]: { $regex: search, $options: 'i' } },
        { [`shortDescription.${language}`]: { $regex: search, $options: 'i' } }
      ];
    }

    // Category filter
    if (category) {
      query[`category.${language}`] = { $regex: category, $options: 'i' };
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    // Filter options
    if (filter) {
      switch (filter) {
        case 'best-seller':
          // Products with high sales or featured status
          query.$or = [
            { isFeatured: true },
            { 'analytics.purchaseCount': { $gte: 50 } },
            { salesQuantity: { $gte: 50 } }
          ];
          break;
        case 'offers':
          // Products with discount
          query.discountPrice = { $exists: true, $ne: null, $gt: 0 };
          break;
        case 'new':
          // Recently added products (last 30 days)
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          query.createdAt = { $gte: thirtyDaysAgo };
          break;
        case 'featured':
          query.isFeatured = true;
          break;
      }
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const products = await Product.find(query)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-__v');

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      count: products.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      products: products.map(product => ({
        id: product._id,
        name: product.name,
        description: product.description,
        shortDescription: product.shortDescription,
        price: product.price,
        discountPrice: product.discountPrice,
        images: product.images,
        category: product.category,
        ingredients: product.ingredients,
        preparationTime: product.preparationTime,
        servingSize: product.servingSize,
        isFeatured: product.isFeatured,
        ratings: product.ratings,
        tags: product.tags,
        nutritionalInfo: product.nutritionalInfo,
        minOrderQuantity: product.minOrderQuantity,
        maxOrderQuantity: product.maxOrderQuantity,
        stock: product.stock
      }))
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get featured products
const getFeaturedProducts = async (req, res) => {
  try {
    const { limit = 6 } = req.query;

    const products = await Product.find({
      isVisible: true,
      isAvailable: true,
      isFeatured: true
    })
      .sort({ displayOrder: 1 })
      .limit(parseInt(limit))
      .select('-__v');

    res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    console.error('Get featured products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get single product
const getProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      isVisible: true
    }).select('-__v');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Track product view
    await Product.findByIdAndUpdate(req.params.id, {
      $inc: { 'analytics.viewCount': 1 },
      $set: { 'analytics.lastViewed': new Date() }
    });

    res.json({
      success: true,
      product
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Create product (Admin only)
const createProduct = async (req, res) => {
  try {
    

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
     
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const productData = { ...req.body };

    // Parse JSON strings from FormData
    try {
      if (typeof productData.name === 'string') {
        productData.name = JSON.parse(productData.name);
      }
      if (typeof productData.description === 'string') {
        productData.description = JSON.parse(productData.description);
      }
      if (typeof productData.category === 'string') {
        productData.category = JSON.parse(productData.category);
      }
      if (typeof productData.ingredients === 'string') {
        productData.ingredients = JSON.parse(productData.ingredients);
      }
    } catch (parseError) {
     
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON data in form fields'
      });
    }

    // Handle file uploads - more flexible validation
    if (req.files && req.files.length > 0) {
      
      productData.images = req.files.map(file => ({
        public_id: file.filename || file.public_id,
        url: file.path || file.secure_url
      }));
      
    } else {
      
      // Check if it's a new product creation - require images
      return res.status(400).json({
        success: false,
        message: 'At least one product image is required'
      });
    }

    

    const product = await Product.create(productData);

    

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Update product (Admin only)
const updateProduct = async (req, res) => {
  try {
    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const updateData = { ...req.body };

    // Parse JSON strings from FormData
    if (typeof updateData.name === 'string') {
      updateData.name = JSON.parse(updateData.name);
    }
    if (typeof updateData.description === 'string') {
      updateData.description = JSON.parse(updateData.description);
    }
    if (typeof updateData.category === 'string') {
      updateData.category = JSON.parse(updateData.category);
    }
    if (typeof updateData.ingredients === 'string') {
      updateData.ingredients = JSON.parse(updateData.ingredients);
    }
    if (typeof updateData.existingImages === 'string') {
      const existingImages = JSON.parse(updateData.existingImages);
      updateData.images = existingImages;
      delete updateData.existingImages;
    }

    // Handle new image uploads
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => ({
        public_id: file.filename,
        url: file.path
      }));

      // If replacing images, delete old ones
      if (updateData.replaceImages === 'true') {
        // Delete old images from Cloudinary
        for (const image of product.images) {
          if (image.public_id && image.public_id !== 'sample_chicken_samosa') {
            try {
              await deleteImage(image.public_id);
            } catch (err) {
              console.error('Error deleting old image:', err);
            }
          }
        }
        updateData.images = newImages;
      } else {
        // Add to existing images
        updateData.images = [...(updateData.images || []), ...newImages];
      }
    }

    // Use set() method for nested objects as per memory [[memory:7441792884359914225]]
    Object.keys(updateData).forEach(key => {
      if (typeof updateData[key] === 'object' && updateData[key] !== null && !Array.isArray(updateData[key])) {
        // For nested objects like name, description, category
        Object.keys(updateData[key]).forEach(nestedKey => {
          product.set(`${key}.${nestedKey}`, updateData[key][nestedKey]);
        });
      } else {
        product.set(key, updateData[key]);
      }
    });

    await product.save();

    res.json({
      success: true,
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Delete product (Admin only)
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Delete images from Cloudinary
    for (const image of product.images) {
      if (image.public_id && image.public_id !== 'sample_chicken_samosa') {
        try {
          await deleteImage(image.public_id);
        } catch (err) {
          console.error('Error deleting image:', err);
        }
      }
    }

    await Product.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Bulk update visibility
const bulkUpdateVisibility = async (req, res) => {
  try {
    const { productIds, isVisible } = req.body;

    if (!productIds || !Array.isArray(productIds)) {
      return res.status(400).json({
        success: false,
        message: 'Product IDs array is required'
      });
    }

    await Product.updateMany(
      { _id: { $in: productIds } },
      { isVisible: Boolean(isVisible) }
    );

    res.json({
      success: true,
      message: `Products ${isVisible ? 'shown' : 'hidden'} successfully`
    });
  } catch (error) {
    console.error('Bulk update visibility error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Bulk update availability
const bulkUpdateAvailability = async (req, res) => {
  try {
    const { productIds, isAvailable } = req.body;

    if (!productIds || !Array.isArray(productIds)) {
      return res.status(400).json({
        success: false,
        message: 'Product IDs array is required'
      });
    }

    await Product.updateMany(
      { _id: { $in: productIds } },
      { isAvailable: Boolean(isAvailable) }
    );

    res.json({
      success: true,
      message: `Products marked as ${isAvailable ? 'available' : 'unavailable'} successfully`
    });
  } catch (error) {
    console.error('Bulk update availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Track add to cart
const trackAddToCart = async (req, res) => {
  try {
    const { productId } = req.params;
    
    await Product.findByIdAndUpdate(productId, {
      $inc: { 'analytics.addToCartCount': 1 }
    });

    res.json({
      success: true,
      message: 'Add to cart tracked'
    });
  } catch (error) {
    console.error('Track add to cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Track purchase
const trackPurchase = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    
    await Product.findByIdAndUpdate(productId, {
      $inc: { 'analytics.purchaseCount': quantity }
    });

    res.json({
      success: true,
      message: 'Purchase tracked'
    });
  } catch (error) {
    console.error('Track purchase error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get product analytics (Admin only)
const getProductAnalytics = async (req, res) => {
  try {
    const { productId } = req.params;
    
    const product = await Product.findById(productId).select('analytics name');
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      analytics: product.analytics,
      productName: product.name
    });
  } catch (error) {
    console.error('Get product analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get all products analytics (Admin only)
const getAllProductsAnalytics = async (req, res) => {
  try {
    const { sortBy = 'viewCount', sortOrder = 'desc', limit = 50 } = req.query;
    
    const sortOptions = {};
    sortOptions[`analytics.${sortBy}`] = sortOrder === 'desc' ? -1 : 1;
    
    const products = await Product.find({})
      .select('name analytics ratings')
      .sort(sortOptions)
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: products.length,
      products: products.map(product => ({
        id: product._id,
        name: product.name,
        analytics: product.analytics,
        ratings: product.ratings
      }))
    });
  } catch (error) {
    console.error('Get all products analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get related products
const getRelatedProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 4 } = req.query;
    
    const product = await Product.findById(id).select('category');
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const relatedProducts = await Product.find({
      _id: { $ne: id },
      isVisible: true,
      isAvailable: true,
      'category.en': product.category.en
    })
    .sort({ 'analytics.viewCount': -1 })
    .limit(parseInt(limit))
    .select('name price discountPrice images ratings analytics');

    res.json({
      success: true,
      count: relatedProducts.length,
      products: relatedProducts
    });
  } catch (error) {
    console.error('Get related products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getProducts,
  getFeaturedProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkUpdateVisibility,
  bulkUpdateAvailability,
  trackAddToCart,
  trackPurchase,
  getProductAnalytics,
  getAllProductsAnalytics,
  getRelatedProducts
}; 