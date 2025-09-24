const express = require('express');
const router = express.Router();
const sslcommerzService = require('../services/sslcommerzService');
const Order = require('../models/Order');

// Multer configuration removed - no longer needed for SSLCommerz or COD

// Payment gateway configurations - only SSLCommerz and Cash on Delivery
const paymentGateways = {
  sslcommerz: {
    enabled: true,
    name: 'SSLCommerz',
    description: 'Pay with Credit/Debit Card, Mobile Banking, Internet Banking'
  },
  cash_on_delivery: {
    enabled: true,
    name: 'Cash on Delivery'
  }
};

// Phone validation removed - not needed for SSLCommerz or COD

// Mobile payment methods removed - only SSLCommerz and Cash on Delivery are supported

// Get payment methods
router.get('/methods', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        sslcommerz: {
          enabled: paymentGateways.sslcommerz.enabled,
          name: 'SSLCommerz',
          logo: '🏦',
          description: 'Pay with Credit/Debit Card, Mobile Banking, Internet Banking',
          supportedMethods: ['visa', 'mastercard', 'brac_visa', 'dbbl_visa', 'amex', 'internet_banking']
        },
        cash_on_delivery: {
          enabled: paymentGateways.cash_on_delivery.enabled,
          name: 'Cash on Delivery',
          logo: '💵'
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get payment methods'
    });
  }
});

// Admin payment settings update - only for SSLCommerz and COD
router.put('/admin/settings', async (req, res) => {
  try {
    const { sslcommerz, cash_on_delivery } = req.body;

    if (sslcommerz) {
      Object.assign(paymentGateways.sslcommerz, sslcommerz);
    }
    if (cash_on_delivery) {
      Object.assign(paymentGateways.cash_on_delivery, cash_on_delivery);
    }

    res.json({
      success: true,
      message: 'Payment settings updated successfully',
      data: paymentGateways
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update payment settings'
    });
  }
});

// SSLCommerz Payment Routes

// Initiate SSLCommerz payment
router.post('/sslcommerz/initiate', async (req, res) => {
  try {
    const { orderNumber, totalAmount, customer, items } = req.body;

    if (!orderNumber || !totalAmount || !customer) {
      return res.status(400).json({
        success: false,
        message: 'Order number, total amount, and customer details are required'
      });
    }

    // Prepare payment data
    const paymentData = {
      orderNumber,
      totalAmount: parseFloat(totalAmount),
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      customerAddress: customer.address,
      items: items || []
    };

    const result = await sslcommerzService.initiatePayment(paymentData);

    if (result.success) {
      res.json({
        success: true,
        message: 'Payment initiated successfully',
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'Failed to initiate payment',
        error: result.error
      });
    }
  } catch (error) {
    console.error('SSLCommerz initiate payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while initiating payment'
    });
  }
});

// SSLCommerz payment success callback
router.post('/sslcommerz/success', async (req, res) => {
  try {
    const responseData = req.body;
    console.log('SSLCommerz success callback received:', responseData);

    // Verify the payment
    const verificationResult = await sslcommerzService.verifyPayment(responseData);

    if (verificationResult.success && verificationResult.verified) {
      // Update order with payment information
      const order = await Order.findOne({ orderNumber: responseData.tran_id });
      
      if (order) {
        // Extract provider details
        const gw = verificationResult.data.gatewayResponse || {};
        const cardBrand = verificationResult.data.cardBrand || gw.card_brand;
        const cardType = verificationResult.data.cardType || gw.card_type;
        const bankTranId = verificationResult.data.bankTransactionId || gw.bank_tran_id;

        // Update payment info using dot notation to avoid nested object issues
        await order.set('paymentInfo.status', 'verified');
        await order.set('paymentInfo.method', 'sslcommerz');
        await order.set('paymentInfo.paymentGateway', 'sslcommerz');
        await order.set('paymentInfo.transactionId', verificationResult.data.transactionId);
        if (bankTranId) await order.set('paymentInfo.bankTransactionId', bankTranId);
        if (cardBrand) await order.set('paymentInfo.cardBrand', cardBrand);
        if (cardType) await order.set('paymentInfo.cardType', cardType);
        await order.set('paymentInfo.provider', cardBrand || cardType || 'sslcommerz');
        await order.set('paymentInfo.gatewayResponse', verificationResult.data.gatewayResponse);
        await order.set('paymentInfo.verifiedAt', new Date());
        await order.set('orderStatus', 'confirmed');
        
        await order.save();

        console.log('✅ Order payment verified and updated:', order.orderNumber);
      }

      // Redirect to frontend success page with payment verification data
      const successUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success?order=${responseData.tran_id}&status=success&verified=true&transactionId=${verificationResult.data.transactionId}&provider=${encodeURIComponent(verificationResult.data.cardBrand || verificationResult.data.cardType || 'sslcommerz')}`;
      res.redirect(successUrl);
    } else {
      console.error('❌ Payment verification failed:', verificationResult);
      const failUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/fail?order=${responseData.tran_id}&status=failed&reason=${encodeURIComponent(verificationResult.message)}`;
      res.redirect(failUrl);
    }
  } catch (error) {
    console.error('SSLCommerz success callback error:', error);
    const failUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/fail?order=${req.body.tran_id || 'unknown'}&status=error&reason=${encodeURIComponent('Server error')}`;
    res.redirect(failUrl);
  }
});

// SSLCommerz payment fail callback
router.post('/sslcommerz/fail', async (req, res) => {
  try {
    const responseData = req.body;
    console.log('SSLCommerz fail callback received:', responseData);

    // Update order status to failed
    if (responseData.tran_id) {
      const order = await Order.findOne({ orderNumber: responseData.tran_id });
      if (order) {
        await order.set('paymentInfo.status', 'failed');
        await order.set('paymentInfo.failureReason', responseData.failedreason || 'Payment failed');
        await order.set('orderStatus', 'cancelled');
        await order.save();
      }
    }

    const failUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/fail?order=${responseData.tran_id || 'unknown'}&status=failed&reason=${encodeURIComponent(responseData.failedreason || 'Payment failed')}`;
    res.redirect(failUrl);
  } catch (error) {
    console.error('SSLCommerz fail callback error:', error);
    const failUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/fail?order=${req.body.tran_id || 'unknown'}&status=error&reason=${encodeURIComponent('Server error')}`;
    res.redirect(failUrl);
  }
});

// SSLCommerz payment cancel callback
router.post('/sslcommerz/cancel', async (req, res) => {
  try {
    const responseData = req.body;
    console.log('SSLCommerz cancel callback received:', responseData);

    // Update order status to cancelled
    if (responseData.tran_id) {
      const order = await Order.findOne({ orderNumber: responseData.tran_id });
      if (order) {
        await order.set('paymentInfo.status', 'cancelled');
        await order.set('paymentInfo.cancellationReason', 'Payment cancelled by user');
        await order.set('orderStatus', 'cancelled');
        await order.save();
      }
    }

    const cancelUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/cancel?order=${responseData.tran_id || 'unknown'}&status=cancelled`;
    res.redirect(cancelUrl);
  } catch (error) {
    console.error('SSLCommerz cancel callback error:', error);
    const cancelUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/cancel?order=${req.body.tran_id || 'unknown'}&status=error`;
    res.redirect(cancelUrl);
  }
});

// SSLCommerz IPN (Instant Payment Notification)
router.post('/sslcommerz/ipn', async (req, res) => {
  try {
    const ipnData = req.body;
    console.log('SSLCommerz IPN received:', ipnData);

    const result = await sslcommerzService.processIPN(ipnData);

    if (result.success && result.processed) {
      // Update order with payment information
      const order = await Order.findOne({ orderNumber: result.orderNumber });
      
      if (order) {
        // IPN may also include brand/type; use what we have
        await order.set('paymentInfo.status', 'verified');
        await order.set('paymentInfo.method', 'sslcommerz');
        await order.set('paymentInfo.paymentGateway', 'sslcommerz');
        await order.set('paymentInfo.transactionId', result.transactionId);
        if (ipnData.bank_tran_id) await order.set('paymentInfo.bankTransactionId', ipnData.bank_tran_id);
        if (ipnData.card_brand) await order.set('paymentInfo.cardBrand', ipnData.card_brand);
        if (ipnData.card_type) await order.set('paymentInfo.cardType', ipnData.card_type);
        await order.set('paymentInfo.provider', ipnData.card_brand || ipnData.card_type || 'sslcommerz');
        await order.set('paymentInfo.verifiedAt', new Date());
        await order.set('orderStatus', 'confirmed');
        await order.save();

        console.log('✅ Order payment verified via IPN:', order.orderNumber);
      }

      res.status(200).json({
        success: true,
        message: 'IPN processed successfully'
      });
    } else {
      console.error('❌ IPN processing failed:', result);
      res.status(400).json({
        success: false,
        message: result.message || 'IPN processing failed'
      });
    }
  } catch (error) {
    console.error('SSLCommerz IPN error:', error);
    res.status(500).json({
      success: false,
      message: 'IPN processing failed'
    });
  }
});

// Get SSLCommerz payment status
router.get('/sslcommerz/status/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    
    const result = await sslcommerzService.getPaymentStatus(orderNumber);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'Failed to get payment status'
      });
    }
  } catch (error) {
    console.error('Get SSLCommerz payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while getting payment status'
    });
  }
});

// SSLCommerz refund
router.post('/sslcommerz/refund', async (req, res) => {
  try {
    const { bankTranId, refundAmount, refundRemarks } = req.body;

    if (!bankTranId || !refundAmount) {
      return res.status(400).json({
        success: false,
        message: 'Bank transaction ID and refund amount are required'
      });
    }

    const refundData = {
      bank_tran_id: bankTranId,
      refund_amount: parseFloat(refundAmount),
      refund_remarks: refundRemarks || 'Refund request'
    };

    const result = await sslcommerzService.refundPayment(refundData);

    if (result.success) {
      res.json({
        success: true,
        message: 'Refund initiated successfully',
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'Refund failed'
      });
    }
  } catch (error) {
    console.error('SSLCommerz refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing refund'
    });
  }
});

module.exports = router; 