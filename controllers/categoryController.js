const Category = require('../models/Category');
const Product = require('../models/Product');

// Get all categories
exports.getAllCategories = async (req, res) => {
  try {
    const { includeInactive = false, withProductCount = false } = req.query;
    
    let query = {};
    if (!includeInactive) {
      query.isActive = true;
    }
    
    let categories;
    if (withProductCount === 'true') {
      categories = await Category.getCategoriesWithProductCount();
    } else {
      categories = await Category.find(query)
        .sort({ sortOrder: 1, createdAt: 1 })
        .populate('parentCategory', 'name slug');
    }
    
    res.json({
      success: true,
      data: categories
    });
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
    const categoryData = req.body;
    
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
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Category with this slug already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create category'
    });
  }
};

// Update category
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
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
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Category with this slug already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to update category'
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
