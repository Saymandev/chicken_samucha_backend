const express = require('express');
const router = express.Router();

const subscriptionController = require('../controllers/subscriptionController');
const adminAuth = require('../middleware/adminAuth');

// Public subscribe
router.post('/subscribe', subscriptionController.subscribe);

// Public unsubscribe
router.post('/unsubscribe', subscriptionController.unsubscribe);
router.get('/unsubscribe/:token', subscriptionController.unsubscribeByToken);

// Admin list (can be protected later)
router.get('/', subscriptionController.list);

// Admin broadcast to subscribers
router.post('/broadcast', adminAuth, subscriptionController.broadcast);

module.exports = router;


