const { validationResult } = require('express-validator');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

// Create new order
const createOrder = async (req, res) => {
  try {
    console.log('=== CREATE ORDER DEBUG ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Request file:', req.file);
    console.log('===========================');

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { customer, items, paymentInfo, deliveryInfo, notes } = req.body;
    
    console.log('Extracted data:', {
      customer,
      items,
      paymentInfo,
      deliveryInfo,
      notes
    });

    // Validate and calculate items
    let totalAmount = 0;
    const orderItems = [];

    console.log('Processing items:', items);

    for (const item of items) {
      console.log('Processing item:', item);
      const product = await Product.findById(item.product);
      console.log('Found product:', product ? product.name : 'Not found');
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.product}`
        });
      }

      if (!product.isAvailable || !product.isVisible) {
        return res.status(400).json({
          success: false,
          message: `Product is not available: ${product.name.en}`
        });
      }

      if (item.quantity < product.minOrderQuantity) {
        return res.status(400).json({
          success: false,
          message: `Minimum order quantity for ${product.name.en} is ${product.minOrderQuantity}`
        });
      }

      if (item.quantity > product.maxOrderQuantity) {
        return res.status(400).json({
          success: false,
          message: `Maximum order quantity for ${product.name.en} is ${product.maxOrderQuantity}`
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name.en}. Available: ${product.stock}`
        });
      }

      const price = product.discountPrice || product.price;
      const subtotal = price * item.quantity;
      totalAmount += subtotal;

      orderItems.push({
        product: product._id,
        name: product.name,
        price: price,
        quantity: item.quantity,
        subtotal: subtotal
      });

      // Update product stock
      product.stock -= item.quantity;
      await product.save();
    }

    // Prepare order data with proper structure
    // Free delivery for orders >= 500
    const baseDeliveryCharge = parseInt(deliveryInfo?.deliveryCharge) || 60;
    const deliveryChargeAmount = deliveryInfo?.method === 'pickup' ? 0 : (totalAmount >= 500 ? 0 : baseDeliveryCharge);
    const discountAmount = 0;
    const finalAmountCalculated = totalAmount + deliveryChargeAmount - discountAmount;
    
    // Generate order number manually to ensure it's set
    const orderCount = await Order.countDocuments();
    const orderNumber = `ORD${Date.now().toString().slice(-6)}${String(orderCount + 1).padStart(3, '0')}`;
    
    // Prepare customer data based on delivery method
    const customerData = {
      name: customer.name,
      phone: customer.phone,
      email: customer.email
    };

    // Only include address for delivery orders
    if (deliveryInfo?.method === 'delivery' && customer.address) {
      customerData.address = customer.address;
    }

    const orderData = {
      orderNumber,
      customer: customerData,
      user: req.user ? req.user.id : null,
      items: orderItems,
      totalAmount,
      deliveryCharge: deliveryChargeAmount,
      discount: discountAmount,
      finalAmount: finalAmountCalculated,
      paymentInfo: {
        method: paymentInfo.method,
        transactionId: paymentInfo.transactionId || undefined,
        paymentNumber: paymentInfo.paymentNumber || undefined,
        notes: paymentInfo.notes || undefined
      },
      deliveryInfo: {
        method: deliveryInfo?.method || 'delivery',
        address: deliveryInfo?.address || (deliveryInfo?.method === 'pickup' ? 'Pickup from restaurant' : ''),
        preferredTime: deliveryInfo?.preferredTime,
        deliveryInstructions: deliveryInfo?.deliveryInstructions
      },
      notes: notes || undefined
    };

    // Handle payment screenshot upload
    if (req.file) {
      orderData.paymentInfo.screenshot = {
        public_id: req.file.filename,
        url: req.file.path
      };
    }

    console.log('Creating order with data:', JSON.stringify(orderData, null, 2));
    const order = await Order.create(orderData);
    console.log('Order created successfully:', order.orderNumber);

    // Emit real-time notification to admin
    if (req.io) {
      req.io.emit('new-order', {
        orderNumber: order.orderNumber,
        customer: order.customer.name,
        totalAmount: order.finalAmount,
        paymentMethod: order.paymentInfo.method
      });
    }

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order: {
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        totalAmount: order.totalAmount,
        finalAmount: order.finalAmount,
        paymentInfo: {
          method: order.paymentInfo.method,
          status: order.paymentInfo.status
        },
        estimatedDeliveryTime: order.estimatedDeliveryTime
      }
    });
  } catch (error) {
    console.error('Create order error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Provide more specific error message for validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Order validation failed',
        errors: validationErrors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while creating order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get user's orders
const getMyOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const query = { user: req.user.id };
    if (status) {
      query.orderStatus = status;
    }

    const orders = await Order.find(query)
      .populate('items.product', 'name images')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      count: orders.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      orders
    });
  } catch (error) {
    console.error('Get my orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Track order (public)
const trackOrder = async (req, res) => {
  try {
    const { orderNumber } = req.params;

    const order = await Order.findOne({ orderNumber })
      .populate('items.product', 'name images')
      .select('-adminNotes');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      order: {
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        items: order.items,
        totalAmount: order.totalAmount,
        finalAmount: order.finalAmount,
        paymentInfo: {
          method: order.paymentInfo.method,
          status: order.paymentInfo.status
        },
        deliveryInfo: order.deliveryInfo,
        statusHistory: order.statusHistory,
        estimatedDeliveryTime: order.estimatedDeliveryTime,
        createdAt: order.createdAt
      }
    });
  } catch (error) {
    console.error('Track order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Enhanced order tracking with phone verification
const trackOrderWithPhone = async (req, res) => {
  try {
    console.log('=== TRACK ORDER DEBUG ===');
    console.log('Request body:', req.body);

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { orderNumber, phone } = req.body;

    // Improve phone number matching - handle various formats
    const phoneVariants = [
      phone,
      phone.replace(/^\+880/, '0'),
      phone.replace(/^0/, '+880'),
      phone.replace(/^(\+880|0)/, ''),
      `+880${phone.replace(/^(\+880|0)/, '')}`,
      `0${phone.replace(/^(\+880|0)/, '')}`
    ];

    console.log('Searching for order:', orderNumber);
    console.log('Phone variants:', phoneVariants);

    const order = await Order.findOne({ 
      orderNumber: orderNumber.toUpperCase(),
      'customer.phone': { $in: phoneVariants }
    })
    .populate('items.product', 'name images')
    .select('-adminNotes -paymentInfo.screenshot');

    console.log('Order found:', !!order);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or phone number does not match. Please check your order number and phone number.'
      });
    }

    // Format items for frontend
    const formattedItems = order.items.map(item => ({
      name: item.product?.name?.en || item.name?.en || item.name || 'Unknown Item',
      quantity: item.quantity,
      price: item.price,
      subtotal: item.subtotal || (item.price * item.quantity)
    }));

    // Create proper status history
    const statusSteps = [
      { status: 'placed', label: 'Order Placed', icon: 'package' },
      { status: 'confirmed', label: 'Order Confirmed', icon: 'check-circle' },
      { status: 'preparing', label: 'Preparing', icon: 'clock' },
      { status: 'ready', label: 'Ready for Delivery', icon: 'package' },
      { status: 'out_for_delivery', label: 'Out for Delivery', icon: 'truck' },
      { status: 'delivered', label: 'Delivered', icon: 'check-circle' }
    ];

    const statusOrder = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'];
    const currentStatusIndex = statusOrder.indexOf(order.orderStatus);

    const statusHistory = statusSteps.map((step, index) => {
      const isCompleted = index <= currentStatusIndex || step.status === 'placed';
      const stepDate = isCompleted ? (index === 0 ? order.createdAt : order.updatedAt) : null;
      
      return {
        status: step.status,
        label: step.label,
        completed: isCompleted,
        date: stepDate,
        time: stepDate ? new Date(stepDate).toLocaleTimeString() : null
      };
    });

    const response = {
      orderNumber: order.orderNumber,
      status: order.orderStatus,
      items: formattedItems,
      total: order.finalAmount || order.totalAmount,
      estimatedDelivery: order.estimatedDeliveryTime,
      statusHistory,
      createdAt: order.createdAt,
      customer: {
        name: order.customer.name,
        phone: order.customer.phone
      },
      paymentInfo: {
        method: order.paymentInfo.method,
        status: order.paymentInfo.status
      }
    };

    console.log('Sending response:', response);

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Enhanced order tracking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while tracking order'
    });
  }
};

// Get all orders (Admin)
const getAllOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      paymentStatus,
      search,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};
    if (status) query.orderStatus = status;
    if (paymentStatus) query['paymentInfo.status'] = paymentStatus;
    
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.phone': { $regex: search, $options: 'i' } }
      ];
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const orders = await Order.find(query)
      .populate('items.product', 'name images')
      .populate('user', 'name email')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      count: orders.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      orders
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get single order (Admin)
const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.product')
      .populate('user', 'name email phone')
      .populate('paymentInfo.verifiedBy', 'name');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Update order status (Admin)
const updateOrderStatus = async (req, res) => {
  try {
    const { status, notes, estimatedDeliveryTime } = req.body;

    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order status'
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const updateData = {
      orderStatus: status,
      modifiedBy: req.user.id
    };

    if (notes) updateData.adminNotes = notes;
    if (estimatedDeliveryTime) updateData.estimatedDeliveryTime = new Date(estimatedDeliveryTime);
    if (status === 'delivered') updateData['deliveryInfo.deliveredAt'] = new Date();

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('items.product', 'name');

    // Emit real-time update to customer
    if (req.io) {
      req.io.to(`order-${order.orderNumber}`).emit('order-status-updated', {
        orderNumber: order.orderNumber,
        newStatus: status,
        estimatedDeliveryTime: updatedOrder.estimatedDeliveryTime
      });
    }

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Verify payment (Admin)
const verifyPayment = async (req, res) => {
  try {
    const { status, notes } = req.body;

    const validStatuses = ['pending', 'verified', 'failed', 'refunded'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment status'
      });
    }

    const updateData = {
      'paymentInfo.status': status,
      'paymentInfo.verifiedBy': req.user.id,
      'paymentInfo.verificationDate': new Date()
    };

    if (notes) updateData['paymentInfo.notes'] = notes;

    // Auto-confirm order if payment is verified
    if (status === 'verified') {
      updateData.orderStatus = 'confirmed';
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('items.product', 'name');

    res.json({
      success: true,
      message: `Payment ${status} successfully`,
      order
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment'
    });
  }
};

// Cancel order (Admin)
const cancelOrder = async (req, res) => {
  try {
    const { cancelReason } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (['delivered', 'cancelled'].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel this order'
      });
    }

    // Restore product stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity }
      });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      {
        orderStatus: 'cancelled',
        cancelReason: cancelReason || 'Cancelled by admin',
        modifiedBy: req.user.id
      },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Dashboard analytics (Admin)
const getDashboardAnalytics = async (req, res) => {
  try {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get various counts and statistics
    const [
      totalOrders,
      totalUsers,
      todayOrders,
      weekOrders,
      monthOrders,
      pendingOrders,
      confirmedOrders,
      deliveredOrders,
      todayRevenue,
      monthRevenue,
      pendingPayments
    ] = await Promise.all([
      Order.countDocuments(),
      User.countDocuments({ role: 'user' }),
      Order.countDocuments({ createdAt: { $gte: startOfToday } }),
      Order.countDocuments({ createdAt: { $gte: startOfWeek } }),
      Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Order.countDocuments({ orderStatus: 'pending' }),
      Order.countDocuments({ orderStatus: 'confirmed' }),
      Order.countDocuments({ orderStatus: 'delivered' }),
      Order.aggregate([
        { $match: { createdAt: { $gte: startOfToday }, orderStatus: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$finalAmount' } } }
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: startOfMonth }, orderStatus: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$finalAmount' } } }
      ]),
      Order.countDocuments({ 'paymentInfo.status': 'pending' })
    ]);

    res.json({
      success: true,
      analytics: {
        orders: {
          total: totalOrders,
          today: todayOrders,
          week: weekOrders,
          month: monthOrders,
          pending: pendingOrders,
          confirmed: confirmedOrders,
          delivered: deliveredOrders
        },
        users: {
          total: totalUsers
        },
        revenue: {
          today: todayRevenue[0]?.total || 0,
          month: monthRevenue[0]?.total || 0
        },
        payments: {
          pending: pendingPayments
        }
      }
    });
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Sales analytics (Admin)
const getSalesAnalytics = async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    
    let groupFormat, startDate;
    const now = new Date();

    switch (period) {
      case 'day':
        groupFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'week':
        groupFormat = { $dateToString: { format: '%Y-W%U', date: '$createdAt' } };
        startDate = new Date(now.setDate(now.getDate() - 56)); // 8 weeks
        break;
      case 'month':
        groupFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
        startDate = new Date(now.setMonth(now.getMonth() - 12)); // 12 months
        break;
      default:
        groupFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
        startDate = new Date(now.setDate(now.getDate() - 30));
    }

    const salesData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          orderStatus: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: groupFormat,
          totalSales: { $sum: '$finalAmount' },
          orderCount: { $sum: 1 },
          avgOrderValue: { $avg: '$finalAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      period,
      salesData
    });
  } catch (error) {
    console.error('Sales analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Request order return
const requestReturn = async (req, res) => {
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

    const { orderNumber, reason, description } = req.body;

    const order = await Order.findOne({ orderNumber });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if order is eligible for return
    if (order.orderStatus !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Only delivered orders can be returned'
      });
    }

    // Check if return window is still open (24 hours)
    const deliveryDate = order.deliveryInfo?.deliveredAt || order.updatedAt;
    const returnDeadline = new Date(deliveryDate.getTime() + 24 * 60 * 60 * 1000); // 24 hours
    
    if (new Date() > returnDeadline) {
      return res.status(400).json({
        success: false,
        message: 'Return window has expired. Returns must be requested within 24 hours of delivery.'
      });
    }

    // Check if return already requested
    if (order.returnRequest) {
      return res.status(400).json({
        success: false,
        message: 'Return request already submitted for this order'
      });
    }

    // Create return request
    const returnRequest = {
      requestedAt: new Date(),
      reason,
      description,
      status: 'pending'
    };

    const updatedOrder = await Order.findByIdAndUpdate(
      order._id,
      { returnRequest },
      { new: true }
    );

    // Emit notification to admin
    if (req.io) {
      req.io.emit('return-request', {
        orderNumber: order.orderNumber,
        customer: order.customer.name,
        reason,
        requestedAt: returnRequest.requestedAt
      });
    }

    res.status(201).json({
      success: true,
      message: 'Return request submitted successfully. We will contact you within 24 hours.',
      data: {
        orderNumber: order.orderNumber,
        returnRequest: returnRequest
      }
    });
  } catch (error) {
    console.error('Return request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing return request'
    });
  }
};

module.exports = {
  createOrder,
  getMyOrders,
  trackOrder,
  trackOrderWithPhone,
  requestReturn,
  getAllOrders,
  getOrder,
  updateOrderStatus,
  verifyPayment,
  cancelOrder,
  getDashboardAnalytics,
  getSalesAnalytics
}; 