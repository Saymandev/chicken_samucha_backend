const express = require('express');
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

router.use(protect); // All user routes require authentication

// Profile routes
router.get('/profile', userController.getProfile);
router.put('/profile', userController.updateProfile);
router.post('/avatar', upload.heroImage.single('avatar'), userController.uploadAvatar);
router.delete('/avatar', userController.deleteAvatar);

// User orders
router.get('/orders', userController.getUserOrders);
router.get('/orders/:id', userController.getUserOrder);

// User reviews
router.get('/reviews', userController.getUserReviews);

module.exports = router; 