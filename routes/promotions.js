const express = require('express');
const router = express.Router();

// Import controllers
const {
  getAllPromotions,
  getPromotion,
  createPromotion,
  updatePromotion,
  deletePromotion,
  togglePromotionStatus,
  getPromotionAnalytics
} = require('../controllers/promotionController');

// Import middleware
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

// Import validation
const { validatePromotion } = require('../middleware/validation');

// Admin routes
router.route('/')
  .get(protect, authorize('admin'), getAllPromotions)
  .post(
    protect, 
    authorize('admin'), 
    upload.fields([
      { name: 'image', maxCount: 1 },
      { name: 'bannerImage', maxCount: 1 }
    ]),
    validatePromotion,
    createPromotion
  );

router.route('/:id')
  .get(protect, authorize('admin'), getPromotion)
  .put(
    protect, 
    authorize('admin'), 
    upload.fields([
      { name: 'image', maxCount: 1 },
      { name: 'bannerImage', maxCount: 1 }
    ]),
    validatePromotion,
    updatePromotion
  )
  .delete(protect, authorize('admin'), deletePromotion);

router.route('/:id/toggle')
  .put(protect, authorize('admin'), togglePromotionStatus);

router.route('/:id/analytics')
  .get(protect, authorize('admin'), getPromotionAnalytics);

module.exports = router;