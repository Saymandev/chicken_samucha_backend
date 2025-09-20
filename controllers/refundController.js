const { validationResult } = require('express-validator');
const Refund = require('../models/Refund');
const Order = require('../models/Order');
const User = require('../models/User');

// @desc    Create refund request (Customer)
// @route   POST /api/refunds
// @access  Private
const createRefundRequest = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { orderNumber, reason, description, refundMethod, refundDetails } = req.body;

    // Find the order
    const order = await Order.findOne({ orderNumber, user: req.user.id });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if order is eligible for refund
    if (!['delivered', 'cancelled'].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Only delivered or cancelled orders are eligible for refund'
      });
    }

    // Check if refund already exists
    const existingRefund = await Refund.findOne({ order: order._id });
    if (existingRefund) {
      return res.status(400).json({
        success: false,
        message: 'Refund request already exists for this order'
      });
    }

    // Calculate refund amount
    let refundAmount = order.finalAmount || order.totalAmount;

    // Create refund request
    const refund = await Refund.create({
      order: order._id,
      orderNumber: order.orderNumber,
      customer: req.user.id,
      amount: refundAmount,
      reason,
      description,
      refundMethod,
      refundDetails
    });

    // Emit notification to admin
    if (req.io) {
      req.io.to('admin-dashboard').emit('new-refund-request', {
        refundId: refund._id,
        orderNumber: order.orderNumber,
        customer: req.user.name,
        amount: refundAmount,
        reason,
        createdAt: refund.createdAt
      });
    }

    res.status(201).json({
      success: true,
      message: 'Refund request submitted successfully',
      refund
    });
  } catch (error) {
    console.error('Create refund request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get customer refund requests
// @route   GET /api/refunds
// @access  Private
const getMyRefunds = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const query = { customer: req.user.id };
    if (status) query.status = status;

    const refunds = await Refund.find(query)
      .populate('order', 'orderNumber orderStatus totalAmount createdAt')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip(skip);

    const total = await Refund.countDocuments(query);

    res.json({
      success: true,
      refunds,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get my refunds error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all refund requests (Admin)
// @route   GET /api/admin/refunds
// @access  Private (Admin)
const getAllRefunds = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } }
      ];
    }

    const refunds = await Refund.find(query)
      .populate('order', 'orderNumber orderStatus totalAmount createdAt')
      .populate('customer', 'name email phone')
      .populate('processedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip(skip);

    const total = await Refund.countDocuments(query);

    res.json({
      success: true,
      refunds,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get all refunds error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update refund status (Admin)
// @route   PUT /api/admin/refunds/:id
// @access  Private (Admin)
const updateRefundStatus = async (req, res) => {
  try {
    const { status, adminNotes, rejectionReason, transactionId } = req.body;

    const validStatuses = ['pending', 'approved', 'rejected', 'processed', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid refund status'
      });
    }

    const refund = await Refund.findById(req.params.id);
    if (!refund) {
      return res.status(404).json({
        success: false,
        message: 'Refund not found'
      });
    }

    const updateData = {
      status,
      processedBy: req.user.id,
      processedAt: new Date()
    };

    if (adminNotes) updateData.adminNotes = adminNotes;
    if (rejectionReason) updateData.rejectionReason = rejectionReason;
    if (transactionId) updateData.transactionId = transactionId;

    const updatedRefund = await Refund.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('order', 'orderNumber orderStatus totalAmount createdAt')
     .populate('customer', 'name email phone');

    // Emit notification to customer
    if (req.io) {
      req.io.to(`user-${refund.customer}`).emit('refund-status-updated', {
        refundId: refund._id,
        orderNumber: refund.orderNumber,
        status,
        message: status === 'approved' ? 'Your refund request has been approved' : 
                 status === 'rejected' ? 'Your refund request has been rejected' :
                 status === 'processed' ? 'Your refund is being processed' :
                 status === 'completed' ? 'Your refund has been completed' : 'Refund status updated'
      });
    }

    res.json({
      success: true,
      message: 'Refund status updated successfully',
      refund: updatedRefund
    });
  } catch (error) {
    console.error('Update refund status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get refund statistics (Admin)
// @route   GET /api/admin/refunds/stats
// @access  Private (Admin)
const getRefundStats = async (req, res) => {
  try {
    const stats = await Refund.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const totalRefunds = await Refund.countDocuments();
    const totalRefundAmount = await Refund.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.json({
      success: true,
      stats: {
        byStatus: stats,
        totalRefunds,
        totalRefundAmount: totalRefundAmount[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('Get refund stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  createRefundRequest,
  getMyRefunds,
  getAllRefunds,
  updateRefundStatus,
  getRefundStats
};
