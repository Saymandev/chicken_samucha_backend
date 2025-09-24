const express = require('express');
const router = express.Router();
const {
  getNavigationMenu,
  getAllNavigationMenus,
  getNavigationMenuById,
  createNavigationMenu,
  updateNavigationMenu,
  deleteNavigationMenu,
  reorderNavigationMenus,
  toggleNavigationMenuStatus
} = require('../controllers/navigationController');
const { validateNavigationMenu, validateReorder } = require('../middleware/navigationValidation');
const { protect, authorize } = require('../middleware/auth');

// Public routes
router.get('/', getNavigationMenu);

// Admin routes
router.get('/admin', protect, authorize('admin'), getAllNavigationMenus);
router.get('/admin/:id', protect, authorize('admin'), getNavigationMenuById);
router.post('/admin', protect, authorize('admin'), validateNavigationMenu, createNavigationMenu);
router.put('/admin/:id', protect, authorize('admin'), validateNavigationMenu, updateNavigationMenu);
router.delete('/admin/:id', protect, authorize('admin'), deleteNavigationMenu);
router.post('/admin/reorder', protect, authorize('admin'), validateReorder, reorderNavigationMenus);
router.patch('/admin/:id/toggle', protect, authorize('admin'), toggleNavigationMenuStatus);

module.exports = router;

