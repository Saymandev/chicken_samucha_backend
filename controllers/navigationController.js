const NavigationMenu = require('../models/NavigationMenu');
const { validationResult } = require('express-validator');

// Get all navigation menu items (public)
const getNavigationMenu = async (req, res) => {
  try {
    const { tree = false } = req.query;
    
    let menuItems;
    if (tree === 'true') {
      menuItems = await NavigationMenu.getMenuTree();
    } else {
      menuItems = await NavigationMenu.getFlatMenu();
    }
    
    res.json({
      success: true,
      data: menuItems
    });
  } catch (error) {
    console.error('Get navigation menu error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch navigation menu',
      error: error.message
    });
  }
};

// Get all navigation menu items (admin)
const getAllNavigationMenus = async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', parent = '' } = req.query;
    const skip = (page - 1) * limit;
    
    let query = {};
    
    // Search functionality
    if (search) {
      query.$or = [
        { 'title.en': { $regex: search, $options: 'i' } },
        { 'title.bn': { $regex: search, $options: 'i' } },
        { path: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Filter by parent
    if (parent === 'root') {
      query.parentId = null;
    } else if (parent) {
      query.parentId = parent;
    }
    
    const menuItems = await NavigationMenu.find(query)
      .populate('parentId', 'title.en')
      .sort({ order: 1, createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await NavigationMenu.countDocuments(query);
    
    res.json({
      success: true,
      data: menuItems,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get all navigation menus error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch navigation menus',
      error: error.message
    });
  }
};

// Get single navigation menu item
const getNavigationMenuById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const menuItem = await NavigationMenu.findById(id)
      .populate('parentId', 'title.en')
      .populate('children', 'title.en order');
    
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Navigation menu item not found'
      });
    }
    
    res.json({
      success: true,
      data: menuItem
    });
  } catch (error) {
    console.error('Get navigation menu by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch navigation menu item',
      error: error.message
    });
  }
};

// Create navigation menu item
const createNavigationMenu = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const menuData = req.body;
    
    // Handle empty parentId - convert to null/undefined
    if (menuData.parentId === '' || menuData.parentId === null) {
      delete menuData.parentId;
    }
    
    // If parentId is provided, validate it exists
    if (menuData.parentId) {
      const parent = await NavigationMenu.findById(menuData.parentId);
      if (!parent) {
        return res.status(400).json({
          success: false,
          message: 'Parent menu item not found'
        });
      }
    }
    
    const menuItem = new NavigationMenu(menuData);
    await menuItem.save();
    
    // Populate the created item
    await menuItem.populate('parentId', 'title.en');
    
    res.status(201).json({
      success: true,
      message: 'Navigation menu item created successfully',
      data: menuItem
    });
  } catch (error) {
    console.error('Create navigation menu error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create navigation menu item',
      error: error.message
    });
  }
};

// Update navigation menu item
const updateNavigationMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const menuData = req.body;
    
    // Handle empty parentId - convert to null/undefined
    if (menuData.parentId === '' || menuData.parentId === null) {
      menuData.parentId = null;
    }
    
    // If parentId is being updated, validate it exists and prevent circular references
    if (menuData.parentId) {
      if (menuData.parentId === id) {
        return res.status(400).json({
          success: false,
          message: 'Menu item cannot be its own parent'
        });
      }
      
      const parent = await NavigationMenu.findById(menuData.parentId);
      if (!parent) {
        return res.status(400).json({
          success: false,
          message: 'Parent menu item not found'
        });
      }
    }
    
    const menuItem = await NavigationMenu.findByIdAndUpdate(
      id,
      menuData,
      { new: true, runValidators: true }
    ).populate('parentId', 'title.en');
    
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Navigation menu item not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Navigation menu item updated successfully',
      data: menuItem
    });
  } catch (error) {
    console.error('Update navigation menu error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update navigation menu item',
      error: error.message
    });
  }
};

// Delete navigation menu item
const deleteNavigationMenu = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if item has children
    const children = await NavigationMenu.find({ parentId: id });
    if (children.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete menu item with children. Please delete children first.'
      });
    }
    
    const menuItem = await NavigationMenu.findByIdAndDelete(id);
    
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Navigation menu item not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Navigation menu item deleted successfully'
    });
  } catch (error) {
    console.error('Delete navigation menu error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete navigation menu item',
      error: error.message
    });
  }
};

// Reorder navigation menu items
const reorderNavigationMenus = async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'Items must be an array'
      });
    }
    
    const updatePromises = items.map((item, index) => 
      NavigationMenu.findByIdAndUpdate(item.id, { order: index })
    );
    
    await Promise.all(updatePromises);
    
    res.json({
      success: true,
      message: 'Navigation menu items reordered successfully'
    });
  } catch (error) {
    console.error('Reorder navigation menus error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reorder navigation menu items',
      error: error.message
    });
  }
};

// Toggle navigation menu item status
const toggleNavigationMenuStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    const menuItem = await NavigationMenu.findById(id);
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Navigation menu item not found'
      });
    }
    
    menuItem.isActive = !menuItem.isActive;
    await menuItem.save();
    
    res.json({
      success: true,
      message: `Navigation menu item ${menuItem.isActive ? 'activated' : 'deactivated'} successfully`,
      data: menuItem
    });
  } catch (error) {
    console.error('Toggle navigation menu status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle navigation menu item status',
      error: error.message
    });
  }
};

module.exports = {
  getNavigationMenu,
  getAllNavigationMenus,
  getNavigationMenuById,
  createNavigationMenu,
  updateNavigationMenu,
  deleteNavigationMenu,
  reorderNavigationMenus,
  toggleNavigationMenuStatus
};

