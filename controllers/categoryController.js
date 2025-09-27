const Category = require('../models/Category');
const Product = require('../models/Product');
const Order = require('../models/Order');

// Get all categories
exports.getAllCategories = async (req, res) => {
  try {
    const { 
      includeInactive = false, 
      withProductCount = false, 
      page = 1, 
      limit = 10, 
      search 
    } = req.query;
    
    let query = {};
    if (!includeInactive) {
      query.isActive = true;
    }
    
    // Add search functionality
    if (search) {
      query.$or = [
        { 'name.en': { $regex: search, $options: 'i' } },
        { 'name.bn': { $regex: search, $options: 'i' } },
        { 'slug': { $regex: search, $options: 'i' } }
      ];
    }
    
    let categories;
    if (withProductCount === 'true') {
      // For pagination with product count, we need to implement it differently
      const skip = (page - 1) * limit;
      const total = await Category.countDocuments(query);
      
      categories = await Category.find(query)
        .sort({ sortOrder: 1, createdAt: 1 })
        .populate('parentCategory', 'name slug')
        .skip(skip)
        .limit(limit * 1);
      
      // Add product count to each category
      categories = await Promise.all(categories.map(async (category) => {
        const productCount = await Product.countDocuments({ 
          category: category._id,
          isVisible: true,
          isAvailable: true
        });
        console.log(`Category ${category.name.en} (${category.slug}) has ${productCount} products`);
        return { ...category.toObject(), productCount };
      }));
      
      res.json({
        success: true,
        data: categories,
        pagination: {
          page: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      });
    } else {
      const skip = (page - 1) * limit;
      const total = await Category.countDocuments(query);
      
      categories = await Category.find(query)
        .sort({ sortOrder: 1, createdAt: 1 })
        .populate('parentCategory', 'name slug')
        .skip(skip)
        .limit(limit * 1);
      
      res.json({
        success: true,
        data: categories,
        pagination: {
          page: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      });
    }
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
};

// Get single category
exports.getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id).populate('parentCategory', 'name slug');
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category'
    });
  }
};

// Create new category
exports.createCategory = async (req, res) => {
  try {
    let categoryData = { ...req.body };
    
    // Parse nested objects from FormData (similar to product creation)
    try {
      if (typeof categoryData.name === 'string') {
        categoryData.name = JSON.parse(categoryData.name);
      }
      if (typeof categoryData.description === 'string') {
        categoryData.description = JSON.parse(categoryData.description);
      }
      if (typeof categoryData.seoTitle === 'string') {
        categoryData.seoTitle = JSON.parse(categoryData.seoTitle);
      }
      if (typeof categoryData.seoDescription === 'string') {
        categoryData.seoDescription = JSON.parse(categoryData.seoDescription);
      }
      if (typeof categoryData.seoKeywords === 'string') {
        categoryData.seoKeywords = JSON.parse(categoryData.seoKeywords);
      }
    } catch (parseError) {
      console.error('FormData parsing error:', parseError);
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON data in form fields'
      });
    }
    
    // Validate required fields
    if (!categoryData.name || !categoryData.name.en || !categoryData.name.bn) {
      return res.status(400).json({
        success: false,
        message: 'Category name in both English and Bengali is required'
      });
    }
    
    if (!categoryData.slug) {
      return res.status(400).json({
        success: false,
        message: 'Category slug is required'
      });
    }
    
    // Handle image upload
    if (req.file) {
      categoryData.image = {
        url: req.file.path,
        public_id: req.file.filename
      };
    }
    
    // Check if slug already exists
    const existingCategory = await Category.findOne({ slug: categoryData.slug });
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category with this slug already exists'
      });
    }
    
    const category = new Category(categoryData);
    await category.save();
    
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    });
  } catch (error) {
    console.error('Create category error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Category validation failed',
        errors: validationErrors
      });
    }
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Category with this slug already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create category',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update category
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    let updateData = { ...req.body };
    
    // Parse nested objects from FormData (similar to create)
    try {
      if (typeof updateData.name === 'string') {
        updateData.name = JSON.parse(updateData.name);
      }
      if (typeof updateData.description === 'string') {
        updateData.description = JSON.parse(updateData.description);
      }
      if (typeof updateData.seoTitle === 'string') {
        updateData.seoTitle = JSON.parse(updateData.seoTitle);
      }
      if (typeof updateData.seoDescription === 'string') {
        updateData.seoDescription = JSON.parse(updateData.seoDescription);
      }
      if (typeof updateData.seoKeywords === 'string') {
        updateData.seoKeywords = JSON.parse(updateData.seoKeywords);
      }
    } catch (parseError) {
      console.error('FormData parsing error:', parseError);
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON data in form fields'
      });
    }
    
    // Handle image upload
    if (req.file) {
      updateData.image = {
        url: req.file.path,
        public_id: req.file.filename
      };
    }
    
    // Check if slug is being changed and if it already exists
    if (updateData.slug) {
      const existingCategory = await Category.findOne({ 
        slug: updateData.slug, 
        _id: { $ne: id } 
      });
      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: 'Category with this slug already exists'
        });
      }
    }
    
    const category = await Category.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Category updated successfully',
      data: category
    });
  } catch (error) {
    console.error('Update category error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Category validation failed',
        errors: validationErrors
      });
    }
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Category with this slug already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update category',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete category
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if category has products
    const productCount = await Product.countDocuments({ category: id });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category. It has ${productCount} products. Please move or delete the products first.`
      });
    }
    
    const category = await Category.findByIdAndDelete(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete category'
    });
  }
};

// Toggle category status
exports.toggleCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    category.isActive = !category.isActive;
    await category.save();
    
    res.json({
      success: true,
      message: `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`,
      data: category
    });
  } catch (error) {
    console.error('Toggle category status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle category status'
    });
  }
};

// Update category sort order
exports.updateCategoryOrder = async (req, res) => {
  try {
    const { categories } = req.body; // Array of { id, sortOrder }
    
    const updatePromises = categories.map(({ id, sortOrder }) =>
      Category.findByIdAndUpdate(id, { sortOrder }, { new: true })
    );
    
    await Promise.all(updatePromises);
    
    res.json({
      success: true,
      message: 'Category order updated successfully'
    });
  } catch (error) {
    console.error('Update category order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update category order'
    });
  }
};

// Get categories for navbar (return tree with children)
exports.getNavbarCategories = async (req, res) => {
  try {
    // Flat list with productCount and parent populated
    const flat = await Category.getCategoriesWithProductCount();

    // Build tree using transformed ids
    const idToNode = new Map();
    flat.forEach(cat => {
      // Normalize id to string for Map keys
      const id = String(cat._id || cat.id);
      idToNode.set(id, { ...cat, id, children: [] });
    });

    const roots = [];
    flat.forEach(cat => {
      const id = String(cat._id || cat.id);
      const parentId = cat.parentCategory ? String(cat.parentCategory._id || cat.parentCategory.id || cat.parentCategory) : null;
      if (parentId && idToNode.has(parentId)) {
        idToNode.get(parentId).children.push(idToNode.get(id));
      } else {
        roots.push(idToNode.get(id));
      }
    });

    res.json({
      success: true,
      data: roots
    });
  } catch (error) {
    console.error('Get navbar categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch navbar categories'
    });
  }
};

// Get top categories based on sales
exports.getTopCategories = async (req, res) => {
  try {
    const { limit = 4 } = req.query;
    
    // Aggregate to get categories with their sales data
    const topCategories = await Order.aggregate([
      // Match only delivered orders
      { $match: { orderStatus: 'delivered' } },
      // Unwind items array
      { $unwind: '$items' },
      // Lookup product details
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'product'
        }
      },
      // Unwind product array
      { $unwind: '$product' },
      // Lookup category details
      {
        $lookup: {
          from: 'categories',
          localField: 'product.category',
          foreignField: '_id',
          as: 'category'
        }
      },
      // Unwind category array
      { $unwind: '$category' },
      // Group by category and calculate sales
      {
        $group: {
          _id: '$category._id',
          name: { $first: '$category.name' },
          slug: { $first: '$category.slug' },
          image: { $first: '$category.image' },
          icon: { $first: '$category.icon' },
          color: { $first: '$category.color' },
          totalSales: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      },
      // Sort by total sales descending
      { $sort: { totalSales: -1 } },
      // Limit results
      { $limit: parseInt(limit) }
    ]);

    res.json({
      success: true,
      data: topCategories
    });
  } catch (error) {
    console.error('Get top categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top categories'
    });
  }
};
