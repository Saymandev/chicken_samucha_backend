const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

// Mock data - In production, these would come from a database
const faqs = [
  {
    id: 1,
    category: 'ordering',
    question: 'How do I place an order?',
    answer: 'You can place an order through our website, mobile app, or by calling our hotline. Browse our menu, select items, and proceed to checkout.',
    isActive: true
  },
  {
    id: 2,
    category: 'ordering',
    question: 'What is the minimum order amount?',
    answer: 'The minimum order amount is 200 BDT for delivery. There\'s no minimum for pickup orders.',
    isActive: true
  },
  {
    id: 3,
    category: 'delivery',
    question: 'What are your delivery areas?',
    answer: 'We deliver across Rangpur city including Rangpur, Dinajpur, Panchagarh, Thakurgaon, and surrounding areas.',
    isActive: true
  },
  {
    id: 4,
    category: 'delivery',
    question: 'How long does delivery take?',
    answer: 'Standard delivery takes 30-45 minutes. During peak hours, it may take up to 60 minutes.',
    isActive: true
  },
  {
    id: 5,
    category: 'payment',
    question: 'What payment methods do you accept?',
    answer: 'We accept cash on delivery, bKash, Nagad, Rocket, Upay, and major credit/debit cards.',
    isActive: true
  },
  {
    id: 6,
    category: 'payment',
    question: 'Is online payment secure?',
    answer: 'Yes, all online payments are processed through secure, encrypted gateways to protect your information.',
    isActive: true
  },
  {
    id: 7,
    category: 'product',
    question: 'Are your samosas halal?',
    answer: 'Yes, all our chicken samosas are 100% halal. We use only halal-certified chicken and ingredients.',
    isActive: true
  },
  {
    id: 8,
    category: 'product',
    question: 'Do you have vegetarian options?',
    answer: 'Currently, we specialize in chicken samosas, but we\'re working on adding vegetarian options soon.',
    isActive: true
  },
  {
    id: 9,
    category: 'account',
    question: 'How do I create an account?',
    answer: 'Click the \'Register\' button, fill in your details, and verify your email address to complete registration.',
    isActive: true
  },
  {
    id: 10,
    category: 'account',
    question: 'Can I track my order history?',
    answer: 'Yes, once you create an account, you can view all your past orders in the \'My Orders\' section.',
    isActive: true
  }
];

// @desc    Send contact message
// @route   POST /api/contact/message
// @access  Public
router.post('/message', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, subject, and message'
      });
    }

    // In production, save to database
    const contactMessage = {
      id: Date.now(),
      name,
      email,
      phone,
      subject,
      message,
      createdAt: new Date(),
      status: 'unread'
    };

    // Mock saving to database
    

    // In production, you might want to:
    // 1. Save to database
    // 2. Send email notification to admin
    // 3. Send auto-reply to customer

    res.status(201).json({
      success: true,
      message: 'Message sent successfully! We will get back to you soon.',
      data: {
        id: contactMessage.id,
        status: 'sent'
      }
    });
  } catch (error) {
    console.error('Error sending contact message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message. Please try again later.'
    });
  }
});

// @desc    Subscribe to newsletter
// @route   POST /api/contact/newsletter
// @access  Public
router.post('/newsletter', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // In production, save to newsletter database
    const subscription = {
      email,
      subscribedAt: new Date(),
      isActive: true
    };

    

    res.status(201).json({
      success: true,
      message: 'Successfully subscribed to newsletter!',
      data: subscription
    });
  } catch (error) {
    console.error('Error subscribing to newsletter:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to subscribe. Please try again later.'
    });
  }
});

// @desc    Get FAQ items
// @route   GET /api/content/faq
// @access  Public
router.get('/faq', async (req, res) => {
  try {
    const { category, search } = req.query;
    let filteredFaqs = faqs.filter(faq => faq.isActive);

    // Filter by category
    if (category && category !== 'all') {
      filteredFaqs = filteredFaqs.filter(faq => faq.category === category);
    }

    // Search functionality
    if (search) {
      const searchTerm = search.toLowerCase();
      filteredFaqs = filteredFaqs.filter(faq =>
        faq.question.toLowerCase().includes(searchTerm) ||
        faq.answer.toLowerCase().includes(searchTerm)
      );
    }

    const categories = [...new Set(faqs.map(faq => faq.category))];

    res.json({
      success: true,
      count: filteredFaqs.length,
      data: filteredFaqs,
      categories
    });
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch FAQs'
    });
  }
});

// @desc    Search FAQ items
// @route   GET /api/content/faq/search
// @access  Public
router.get('/faq/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const searchTerm = q.toLowerCase();
    const searchResults = faqs.filter(faq =>
      faq.isActive &&
      (faq.question.toLowerCase().includes(searchTerm) ||
       faq.answer.toLowerCase().includes(searchTerm))
    );

    res.json({
      success: true,
      count: searchResults.length,
      data: searchResults,
      query: q
    });
  } catch (error) {
    console.error('Error searching FAQs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search FAQs'
    });
  }
});

// @desc    Get return policy
// @route   GET /api/content/return-policy
// @access  Public
router.get('/return-policy', async (req, res) => {
  try {
    const returnPolicy = {
      lastUpdated: '2024-01-15',
      sections: {
        overview: 'We want you to be completely satisfied with your order.',
        timeLimit: '24 hours from delivery',
        conditions: [
          'Food must be fresh and unopened',
          'Original packaging required',
          'Order receipt needed'
        ],
        process: [
          'Contact support team',
          'Provide order details',
          'Keep food in original packaging',
          'Wait for pickup instructions'
        ]
      }
    };

    res.json({
      success: true,
      data: returnPolicy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch return policy'
    });
  }
});

// @desc    Get refund policy
// @route   GET /api/content/refund-policy
// @access  Public
router.get('/refund-policy', async (req, res) => {
  try {
    const refundPolicy = {
      lastUpdated: '2024-01-15',
      sections: {
        overview: 'Fair and transparent refund policy',
        eligibility: [
          'Defective or damaged products',
          'Wrong order delivered',
          'Significant delay in delivery'
        ],
        timeline: '3-5 business days for refund processing',
        methods: ['Mobile banking', 'Bank transfer']
      }
    };

    res.json({
      success: true,
      data: refundPolicy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch refund policy'
    });
  }
});

// @desc    Get privacy policy
// @route   GET /api/content/privacy-policy
// @access  Public
router.get('/privacy-policy', async (req, res) => {
  try {
    const privacyPolicy = {
      lastUpdated: '2024-01-15',
      sections: {
        overview: 'We respect your privacy and protect your personal information',
        dataCollection: [
          'Personal information for orders',
          'Usage data for analytics',
          'Payment information for transactions'
        ],
        dataUse: [
          'Processing orders',
          'Customer communication',
          'Service improvement'
        ],
        dataProtection: [
          'Encrypted data transmission',
          'Secure storage',
          'Limited access'
        ]
      }
    };

    res.json({
      success: true,
      data: privacyPolicy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch privacy policy'
    });
  }
});

// @desc    Get terms of service
// @route   GET /api/content/terms-of-service
// @access  Public
router.get('/terms-of-service', async (req, res) => {
  try {
    const termsOfService = {
      lastUpdated: '2024-01-15',
      sections: {
        agreement: 'By using our services, you agree to these terms',
        services: [
          'Online food ordering',
          'Delivery service',
          'Customer support'
        ],
        userResponsibilities: [
          'Provide accurate information',
          'Make legitimate orders',
          'Respect our policies'
        ],
        limitations: 'Liability limited to order value'
      }
    };

    res.json({
      success: true,
      data: termsOfService
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch terms of service'
    });
  }
});

// @desc    Get cookie policy
// @route   GET /api/content/cookie-policy
// @access  Public
router.get('/cookie-policy', async (req, res) => {
  try {
    const cookiePolicy = {
      lastUpdated: '2024-01-15',
      sections: {
        overview: 'We use cookies to improve your experience',
        types: {
          essential: 'Required for basic functionality',
          functional: 'Remember your preferences',
          analytics: 'Help us understand usage',
          marketing: 'Show relevant ads'
        },
        management: 'You can control cookies through browser settings'
      }
    };

    res.json({
      success: true,
      data: cookiePolicy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cookie policy'
    });
  }
});

// @desc    Save cookie preferences
// @route   POST /api/support/cookie-preferences
// @access  Public
router.post('/cookie-preferences', async (req, res) => {
  try {
    const { preferences } = req.body;

    // In production, save preferences to database or cookies
    

    res.json({
      success: true,
      message: 'Cookie preferences saved successfully',
      data: preferences
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to save cookie preferences'
    });
  }
});

// @desc    Subscribe to notifications
// @route   POST /api/notifications/subscribe
// @access  Public
router.post('/subscribe', async (req, res) => {
  try {
    const { type, email, preferences } = req.body;

    if (!type || !email) {
      return res.status(400).json({
        success: false,
        message: 'Type and email are required'
      });
    }

    const subscription = {
      id: Date.now(),
      type,
      email,
      preferences: preferences || {},
      subscribedAt: new Date(),
      isActive: true
    };

   

    res.status(201).json({
      success: true,
      message: 'Successfully subscribed to notifications!',
      data: subscription
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to subscribe to notifications'
    });
  }
});

module.exports = router; 