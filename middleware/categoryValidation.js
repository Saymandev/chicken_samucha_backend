const { body } = require('express-validator');

const validateCategory = [
  body('name.en')
    .notEmpty()
    .withMessage('English name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('English name must be between 1 and 100 characters'),
  
  body('name.bn')
    .notEmpty()
    .withMessage('Bengali name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Bengali name must be between 1 and 100 characters'),
  
  body('slug')
    .notEmpty()
    .withMessage('Slug is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Slug must be between 1 and 100 characters')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug can only contain lowercase letters, numbers, and hyphens'),
  
  body('description.en')
    .optional()
    .isLength({ max: 500 })
    .withMessage('English description must be less than 500 characters'),
  
  body('description.bn')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bengali description must be less than 500 characters'),
  
  body('icon')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Icon must be less than 50 characters'),
  
  body('color')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Color must be a valid hex color code'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  
  body('sortOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a non-negative integer'),
  
  body('parentCategory')
    .optional()
    .custom((value) => {
      // Allow empty string, null, or undefined for parent categories
      if (!value || value === '' || value === null || value === undefined) {
        return true;
      }
      // If value is provided, it must be a valid MongoDB ObjectId
      const mongoose = require('mongoose');
      return mongoose.Types.ObjectId.isValid(value);
    })
    .withMessage('Parent category must be a valid MongoDB ObjectId or empty for parent categories'),
  
  body('isSubcategory')
    .optional()
    .isBoolean()
    .withMessage('isSubcategory must be a boolean'),
  
  body('seoTitle.en')
    .optional()
    .isLength({ max: 60 })
    .withMessage('English SEO title must be less than 60 characters'),
  
  body('seoTitle.bn')
    .optional()
    .isLength({ max: 60 })
    .withMessage('Bengali SEO title must be less than 60 characters'),
  
  body('seoDescription.en')
    .optional()
    .isLength({ max: 160 })
    .withMessage('English SEO description must be less than 160 characters'),
  
  body('seoDescription.bn')
    .optional()
    .isLength({ max: 160 })
    .withMessage('Bengali SEO description must be less than 160 characters'),
  
  body('seoKeywords')
    .optional()
    .isArray()
    .withMessage('SEO keywords must be an array'),
  
  body('seoKeywords.*')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Each SEO keyword must be less than 50 characters')
];

module.exports = {
  validateCategory
};
