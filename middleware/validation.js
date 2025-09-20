const { body, validationResult } = require('express-validator');

// Promotion validation
exports.validatePromotion = [
  body('title.en')
    .notEmpty()
    .withMessage('English title is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('English title must be between 3 and 100 characters'),
  
  body('title.bn')
    .notEmpty()
    .withMessage('Bengali title is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Bengali title must be between 3 and 100 characters'),
  
  body('description.en')
    .notEmpty()
    .withMessage('English description is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('English description must be between 10 and 500 characters'),
  
  body('description.bn')
    .notEmpty()
    .withMessage('Bengali description is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Bengali description must be between 10 and 500 characters'),
  
  body('type')
    .isIn(['discount', 'special_offer', 'announcement', 'seasonal', 'flash_sale'])
    .withMessage('Invalid promotion type'),
  
  body('discountType')
    .isIn(['percentage', 'fixed_amount', 'buy_x_get_y', 'free_shipping'])
    .withMessage('Invalid discount type'),
  
  body('discountValue')
    .isNumeric()
    .withMessage('Discount value must be a number')
    .isFloat({ min: 0 })
    .withMessage('Discount value must be positive'),
  
  body('validFrom')
    .isISO8601()
    .withMessage('Valid from must be a valid date'),
  
  body('validUntil')
    .isISO8601()
    .withMessage('Valid until must be a valid date')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.validFrom)) {
        throw new Error('Valid until must be after valid from date');
      }
      return true;
    }),
  
  body('priority')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Priority must be between 1 and 10'),
  
  body('targetAudience')
    .optional()
    .isIn(['all', 'new_users', 'returning_users', 'vip_users'])
    .withMessage('Invalid target audience'),
  
  body('displayFrequency')
    .optional()
    .isIn(['once_per_session', 'once_per_day', 'always', 'custom'])
    .withMessage('Invalid display frequency'),
  
  body('displayRules.minimumOrderAmount')
    .optional()
    .isNumeric()
    .withMessage('Minimum order amount must be a number')
    .isFloat({ min: 0 })
    .withMessage('Minimum order amount must be positive'),
  
  body('ctaButton.text.en')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('English CTA text must be between 2 and 50 characters'),
  
  body('ctaButton.text.bn')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Bengali CTA text must be between 2 and 50 characters'),
  
  body('ctaButton.action')
    .optional()
    .isIn(['navigate', 'apply_coupon', 'open_catalog', 'contact_us'])
    .withMessage('Invalid CTA action'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];
