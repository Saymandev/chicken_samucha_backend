const express = require('express');
const router = express.Router();

const subscriptionController = require('../controllers/subscriptionController');
const { protect, authorize } = require('../middleware/auth');

// Public subscribe disabled (auto-subscribe via registration)
// router.post('/subscribe', subscriptionController.subscribe);

// Public unsubscribe
router.post('/unsubscribe', subscriptionController.unsubscribe);
router.get('/unsubscribe/:token', subscriptionController.unsubscribeByToken);

// Admin list (protect via standard admin auth)
router.get('/', protect, authorize('admin'), subscriptionController.list);

// Admin broadcast to subscribers
router.post('/broadcast', protect, authorize('admin'), subscriptionController.broadcast);

module.exports = router;


