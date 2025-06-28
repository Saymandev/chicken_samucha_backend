const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Configure multer for payment screenshot uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/payments/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'payment-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Mock payment gateway configurations
const mockPaymentGateways = {
  bkash: {
    merchantNumber: '01234567890',
    apiKey: 'bkash_api_key_here',
    enabled: true
  },
  nagad: {
    merchantNumber: '01234567891', 
    apiKey: 'nagad_api_key_here',
    enabled: true
  },
  rocket: {
    merchantNumber: '01234567892',
    apiKey: 'rocket_api_key_here', 
    enabled: true
  },
  upay: {
    merchantNumber: '01234567893',
    apiKey: 'upay_api_key_here',
    enabled: false
  }
};

// Validate Bangladesh phone number
const validateBDPhone = (phone) => {
  const bdPhoneRegex = /^01[3-9]\d{8}$/;
  return bdPhoneRegex.test(phone);
};

// bKash payment initiation
router.post('/bkash/initiate', async (req, res) => {
  try {
    const { amount, customerPhone, reference } = req.body;

    if (!amount || !customerPhone) {
      return res.status(400).json({
        success: false,
        message: 'Amount and customer phone are required'
      });
    }

    if (!validateBDPhone(customerPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Bangladesh phone number'
      });
    }

    const paymentId = 'BKH' + Date.now();
    
    res.json({
      success: true,
      data: {
        paymentId,
        merchantNumber: mockPaymentGateways.bkash.merchantNumber,
        amount,
        reference: reference || customerPhone,
        instructions: [
          'Open bKash app or dial *247#',
          'Select "Send Money"', 
          `Enter merchant number: ${mockPaymentGateways.bkash.merchantNumber}`,
          `Enter amount: ৳${amount}`,
          `Enter reference: ${reference || customerPhone}`,
          'Complete the transaction',
          'Take a screenshot and upload'
        ]
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to initiate bKash payment'
    });
  }
});

// Nagad payment initiation
router.post('/nagad/initiate', async (req, res) => {
  try {
    const { amount, customerPhone, reference } = req.body;

    const paymentId = 'NGD' + Date.now();
    
    res.json({
      success: true,
      data: {
        paymentId,
        merchantNumber: mockPaymentGateways.nagad.merchantNumber,
        amount,
        reference: reference || customerPhone,
        instructions: [
          'Open Nagad app or dial *167#',
          'Select "Send Money"',
          `Enter merchant number: ${mockPaymentGateways.nagad.merchantNumber}`,
          `Enter amount: ৳${amount}`,
          `Enter reference: ${reference || customerPhone}`,
          'Complete the transaction',
          'Take a screenshot and upload'
        ]
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to initiate Nagad payment'
    });
  }
});

// Rocket payment initiation
router.post('/rocket/initiate', async (req, res) => {
  try {
    const { amount, customerPhone, reference } = req.body;

    const paymentId = 'RKT' + Date.now();
    
    res.json({
      success: true,
      data: {
        paymentId,
        merchantNumber: mockPaymentGateways.rocket.merchantNumber,
        amount,
        reference: reference || customerPhone
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to initiate Rocket payment'
    });
  }
});

// General mobile payment verification
router.post('/mobile/verify', upload.single('screenshot'), async (req, res) => {
  try {
    const { method, transactionId, amount, customerPhone } = req.body;
    const screenshot = req.file;

    if (!method || !transactionId) {
      return res.status(400).json({
        success: false,
        message: 'Payment method and transaction ID are required'
      });
    }

    if (!mockPaymentGateways[method]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method'
      });
    }

    // Mock payment verification
    const isValidTransaction = transactionId.length >= 6;
    
    if (!isValidTransaction) {
      return res.status(400).json({
        success: false,
        message: 'Invalid transaction ID format'
      });
    }

    const verificationResult = {
      transactionId,
      method,
      status: 'verified',
      amount: parseFloat(amount),
      customerPhone,
      screenshot: screenshot ? {
        filename: screenshot.filename,
        path: screenshot.path,
        url: `/uploads/payments/${screenshot.filename}`
      } : null,
      verifiedAt: new Date(),
      gatewayResponse: {
        success: true,
        gateway: method,
        reference: transactionId
      }
    };

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: verificationResult
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment'
    });
  }
});

// Get payment methods
router.get('/methods', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        bkash: {
          enabled: mockPaymentGateways.bkash.enabled,
          merchantNumber: mockPaymentGateways.bkash.merchantNumber,
          name: 'bKash',
          logo: '📱'
        },
        nagad: {
          enabled: mockPaymentGateways.nagad.enabled,
          merchantNumber: mockPaymentGateways.nagad.merchantNumber,
          name: 'Nagad',
          logo: '💰'
        },
        rocket: {
          enabled: mockPaymentGateways.rocket.enabled,
          merchantNumber: mockPaymentGateways.rocket.merchantNumber,
          name: 'Rocket',
          logo: '🚀'
        },
        upay: {
          enabled: mockPaymentGateways.upay.enabled,
          merchantNumber: mockPaymentGateways.upay.merchantNumber,
          name: 'Upay',
          logo: '💳'
        },
        cash_on_delivery: {
          enabled: true,
          name: 'Cash on Delivery',
          logo: '💵',
          deliveryCharge: 60
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

// Admin payment settings update
router.put('/admin/settings', async (req, res) => {
  try {
    const { bkash, nagad, rocket, upay } = req.body;

    if (bkash) {
      Object.assign(mockPaymentGateways.bkash, bkash);
    }
    if (nagad) {
      Object.assign(mockPaymentGateways.nagad, nagad);
    }
    if (rocket) {
      Object.assign(mockPaymentGateways.rocket, rocket);
    }
    if (upay) {
      Object.assign(mockPaymentGateways.upay, upay);
    }

    res.json({
      success: true,
      message: 'Payment settings updated successfully',
      data: mockPaymentGateways
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update payment settings'
    });
  }
});

module.exports = router; 