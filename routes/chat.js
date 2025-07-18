const express = require('express');
const { body } = require('express-validator');
const chatController = require('../controllers/chatController');
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

// Message validation - simplified for debugging
const messageValidation = [
  body('message').notEmpty().withMessage('Message is required')
];

// Public/User routes with optional auth
router.post('/session', optionalAuth, chatController.startChatSession);
router.put('/session/:chatId', optionalAuth, chatController.updateChatSession);
router.get('/:chatId/messages', chatController.getChatMessages);
router.post('/message', optionalAuth, upload.chatAttachment.single('attachment'), chatController.sendMessage);

// Admin routes
router.get('/sessions', protect, authorize('admin'), chatController.getChatSessions);
router.get('/session/:chatId', protect, authorize('admin'), chatController.getChatSession);
router.put('/admin/session/:chatId/assign', protect, authorize('admin'), chatController.assignChatToAdmin);
router.put('/admin/session/:chatId/status', protect, authorize('admin'), chatController.updateChatStatus);
router.post('/admin/message', 
  protect, 
  authorize('admin'),
  upload.chatAttachment.single('attachment'),
  chatController.sendAdminMessage
);

// Mark message as read
router.put('/message/:messageId/read', chatController.markMessageAsRead);

// End chat session
router.put('/session/:chatId/end', chatController.endChatSession);

// Cleanup duplicate sessions (admin only)
router.post('/admin/cleanup-duplicates', protect, authorize('admin'), chatController.cleanupDuplicateSessions);

module.exports = router; 