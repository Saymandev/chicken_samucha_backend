const express = require('express');
const router = express.Router();

// Import controllers
const {
  getActivePromotions,
  trackPromotionView,
  trackPromotionClick,
  trackPromotionConversion,
  getPromotionById
} = require('../controllers/publicPromotionController');

// Public routes
router.route('/')
  .get(getActivePromotions);

router.route('/:id')
  .get(getPromotionById);

router.route('/:id/view')
  .post(trackPromotionView);

router.route('/:id/click')
  .post(trackPromotionClick);

router.route('/:id/conversion')
  .post(trackPromotionConversion);

module.exports = router;
