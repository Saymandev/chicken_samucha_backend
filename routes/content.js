const express = require('express');
const contentController = require('../controllers/contentController');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

// Public routes - get content
router.get('/hero', contentController.getHeroContent);
router.get('/slider', contentController.getSliderItems);
router.get('/payment-settings', contentController.getPublicPaymentSettings);
router.get('/announcement', contentController.getAnnouncement);

// Admin routes - manage content
router.put('/hero', protect, authorize('admin'), upload.heroImage.single('heroImage'), contentController.updateHeroContent);
router.post('/slider', protect, authorize('admin'), upload.sliderImage.single('image'), contentController.createSliderItem);
router.put('/slider/:id', protect, authorize('admin'), upload.sliderImage.single('image'), contentController.updateSliderItem);
router.delete('/slider/:id', protect, authorize('admin'), contentController.deleteSliderItem);
router.put('/slider/reorder', protect, authorize('admin'), contentController.reorderSliderItems);

// Admin - announcements
router.post('/announcement', protect, authorize('admin'), contentController.createAnnouncement);
router.put('/announcement/:id', protect, authorize('admin'), contentController.updateAnnouncement);
router.delete('/announcement/:id', protect, authorize('admin'), contentController.deleteAnnouncement);

module.exports = router; 