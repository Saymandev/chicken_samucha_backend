const { body } = require('express-validator');

const validateNavigationMenu = [
  body('title.en')
    .notEmpty()
    .withMessage('English title is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('English title must be between 1 and 100 characters'),
  
  body('title.bn')
    .notEmpty()
    .withMessage('Bengali title is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Bengali title must be between 1 and 100 characters'),
  
  body('path')
    .notEmpty()
    .withMessage('Path is required')
    .isLength({ min: 1, max: 200 })
    .withMessage('Path must be between 1 and 200 characters')
    .custom((value) => {
      // Check if it's a valid URL or path
      if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/')) {
        return true;
      }
      throw new Error('Path must be a valid URL or start with /');
    }),
  
  body('icon')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Icon must be less than 50 characters'),
  
  body('badge.text')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Badge text must be less than 20 characters'),
  
  body('badge.color')
    .optional()
    .isIn(['red', 'orange', 'green', 'blue', 'purple'])
    .withMessage('Badge color must be one of: red, orange, green, blue, purple'),
  
  body('order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Order must be a non-negative integer'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  
  body('isExternal')
    .optional()
    .isBoolean()
    .withMessage('isExternal must be a boolean'),
  
  body('target')
    .optional()
    .isIn(['_self', '_blank'])
    .withMessage('Target must be either _self or _blank'),
  
  body('parentId')
    .optional()
    .isMongoId()
    .withMessage('Parent ID must be a valid MongoDB ObjectId'),
  
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array'),
  
  body('permissions.*')
    .optional()
    .isIn(['public', 'authenticated', 'admin', 'guest'])
    .withMessage('Each permission must be one of: public, authenticated, admin, guest'),
  
  body('cssClass')
    .optional()
    .isLength({ max: 100 })
    .withMessage('CSS class must be less than 100 characters'),
  
  body('description.en')
    .optional()
    .isLength({ max: 500 })
    .withMessage('English description must be less than 500 characters'),
  
  body('description.bn')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bengali description must be less than 500 characters')
];

const validateReorder = [
  body('items')
    .isArray()
    .withMessage('Items must be an array'),
  
  body('items.*.id')
    .isMongoId()
    .withMessage('Each item must have a valid ID'),
  
  body('items.*.order')
    .isInt({ min: 0 })
    .withMessage('Each item must have a valid order number')
];

module.exports = {
  validateNavigationMenu,
  validateReorder
};

