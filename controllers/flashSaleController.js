const FlashSale = require('../models/FlashSale');
const Product = require('../models/Product');
const { validationResult } = require('express-validator');

// Get current active flash sales (Public)
exports.getCurrentFlashSales = async (req, res) => {
  try {
    const flashSales = await FlashSale.getCurrentActive();
    
    const activeSales = flashSales.map(sale => ({
      id: sale._id,
      title: sale.title,
      description: sale.description,
      endTime: sale.endTime,
      remainingTime: sale.getRemainingTime(),
      backgroundColor: sale.backgroundColor,
      textColor: sale.textColor,
      products: sale.products.map(item => ({
        product: item.product,
        originalPrice: item.originalPrice,
        flashSalePrice: item.flashSalePrice,
        stockLimit: item.stockLimit,
        soldCount: item.soldCount,
        remainingStock: item.stockLimit ? item.stockLimit - item.soldCount : null,
        discountPercentage: Math.round(((item.originalPrice - item.flashSalePrice) / item.originalPrice) * 100)
      }))
    }));

    res.json({
      success: true,
      flashSales: activeSales
    });
  } catch (error) {
    console.error('Get current flash sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch flash sales'
    });
  }
};

// Get upcoming flash sales (Public)
exports.getUpcomingFlashSales = async (req, res) => {
  try {
    const flashSales = await FlashSale.getUpcoming().limit(5);
    
    res.json({
      success: true,
      upcomingFlashSales: flashSales
    });
  } catch (error) {
    console.error('Get upcoming flash sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming flash sales'
    });
  }
};

// Get flash sale by ID (Public)
exports.getFlashSaleById = async (req, res) => {
  try {
    const { id } = req.params;
    const flashSale = await FlashSale.findById(id).populate('products.product');
    
    if (!flashSale) {
      return res.status(404).json({
        success: false,
        message: 'Flash sale not found'
      });
    }

    const saleData = {
      ...flashSale.toObject(),
      isCurrentlyActive: flashSale.isCurrentlyActive,
      remainingTime: flashSale.getRemainingTime()
    };

    res.json({
      success: true,
      flashSale: saleData
    });
  } catch (error) {
    console.error('Get flash sale by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch flash sale'
    });
  }
};

// Admin: Get all flash sales
exports.getAllFlashSales = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (status === 'active') {
      const now = new Date();
      query = {
        isActive: true,
        startTime: { $lte: now },
        endTime: { $gt: now }
      };
    } else if (status === 'upcoming') {
      const now = new Date();
      query = {
        isActive: true,
        startTime: { $gt: now }
      };
    } else if (status === 'expired') {
      const now = new Date();
      query = {
        $or: [
          { isActive: false },
          { endTime: { $lte: now } }
        ]
      };
    }

    const flashSales = await FlashSale.find(query)
      .populate('products.product')
      .populate('createdBy', 'name email')
      .sort({ priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await FlashSale.countDocuments(query);

    res.json({
      success: true,
      flashSales,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get all flash sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch flash sales'
    });
  }
};

// Admin: Create flash sale
exports.createFlashSale = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      title,
      description,
      startTime,
      endTime,
      discountType,
      discountValue,
      maxDiscountAmount,
      products,
      backgroundColor,
      textColor,
      priority
    } = req.body;

    // Validate products and calculate flash sale prices
    const processedProducts = [];
    for (const item of products) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Product not found: ${item.productId}`
        });
      }

      let flashSalePrice;
      if (discountType === 'percentage') {
        const discount = (product.price * discountValue) / 100;
        const cappedDiscount = maxDiscountAmount ? Math.min(discount, maxDiscountAmount) : discount;
        flashSalePrice = product.price - cappedDiscount;
      } else {
        flashSalePrice = Math.max(0, product.price - discountValue);
      }

      processedProducts.push({
        product: product._id,
        originalPrice: product.price,
        flashSalePrice: Math.round(flashSalePrice),
        stockLimit: item.stockLimit,
        soldCount: 0
      });
    }

    const flashSale = new FlashSale({
      title,
      description,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      discountType,
      discountValue,
      maxDiscountAmount,
      products: processedProducts,
      backgroundColor,
      textColor,
      priority,
      createdBy: req.user._id
    });

    await flashSale.save();

    res.status(201).json({
      success: true,
      message: 'Flash sale created successfully',
      flashSale
    });
  } catch (error) {
    console.error('Create flash sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create flash sale'
    });
  }
};

// Admin: Update flash sale
exports.updateFlashSale = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const flashSale = await FlashSale.findById(id);
    if (!flashSale) {
      return res.status(404).json({
        success: false,
        message: 'Flash sale not found'
      });
    }

    // If products are being updated, recalculate prices
    if (updates.products) {
      const processedProducts = [];
      for (const item of updates.products) {
        const product = await Product.findById(item.productId);
        if (!product) {
          return res.status(400).json({
            success: false,
            message: `Product not found: ${item.productId}`
          });
        }

        let flashSalePrice;
        const discountType = updates.discountType || flashSale.discountType;
        const discountValue = updates.discountValue || flashSale.discountValue;
        const maxDiscountAmount = updates.maxDiscountAmount || flashSale.maxDiscountAmount;

        if (discountType === 'percentage') {
          const discount = (product.price * discountValue) / 100;
          const cappedDiscount = maxDiscountAmount ? Math.min(discount, maxDiscountAmount) : discount;
          flashSalePrice = product.price - cappedDiscount;
        } else {
          flashSalePrice = Math.max(0, product.price - discountValue);
        }

        processedProducts.push({
          product: product._id,
          originalPrice: product.price,
          flashSalePrice: Math.round(flashSalePrice),
          stockLimit: item.stockLimit,
          soldCount: item.soldCount || 0
        });
      }
      updates.products = processedProducts;
    }

    const updatedFlashSale = await FlashSale.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).populate('products.product');

    res.json({
      success: true,
      message: 'Flash sale updated successfully',
      flashSale: updatedFlashSale
    });
  } catch (error) {
    console.error('Update flash sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update flash sale'
    });
  }
};

// Admin: Delete flash sale
exports.deleteFlashSale = async (req, res) => {
  try {
    const { id } = req.params;

    const flashSale = await FlashSale.findById(id);
    if (!flashSale) {
      return res.status(404).json({
        success: false,
        message: 'Flash sale not found'
      });
    }

    await FlashSale.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Flash sale deleted successfully'
    });
  } catch (error) {
    console.error('Delete flash sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete flash sale'
    });
  }
};

// Admin: Toggle flash sale status
exports.toggleFlashSaleStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const flashSale = await FlashSale.findById(id);
    if (!flashSale) {
      return res.status(404).json({
        success: false,
        message: 'Flash sale not found'
      });
    }

    flashSale.isActive = !flashSale.isActive;
    await flashSale.save();

    res.json({
      success: true,
      message: `Flash sale ${flashSale.isActive ? 'activated' : 'deactivated'} successfully`,
      flashSale
    });
  } catch (error) {
    console.error('Toggle flash sale status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle flash sale status'
    });
  }
};
