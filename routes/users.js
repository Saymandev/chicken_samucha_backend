const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

// User routes
router.use(protect);

// Get user profile
router.get('/profile', userController.getUserProfile);

// Update user profile
router.put('/profile', userController.updateUserProfile);

// Update user password
router.put('/password', [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], userController.updateUserPassword);

// Avatar upload
router.post('/avatar', upload.single('avatar'), userController.uploadAvatar);

// User notifications
router.get('/notifications', userController.getUserNotifications);
router.put('/notifications/:id/read', userController.markNotificationAsRead);
router.put('/notifications/mark-all-read', userController.markAllNotificationsAsRead);

module.exports = router; 