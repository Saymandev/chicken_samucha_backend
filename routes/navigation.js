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
const { adminAuth } = require('../middleware/adminAuth');

// Public routes
router.get('/', getNavigationMenu);

// Admin routes
router.get('/admin', adminAuth, getAllNavigationMenus);
router.get('/admin/:id', adminAuth, getNavigationMenuById);
router.post('/admin', adminAuth, validateNavigationMenu, createNavigationMenu);
router.put('/admin/:id', adminAuth, validateNavigationMenu, updateNavigationMenu);
router.delete('/admin/:id', adminAuth, deleteNavigationMenu);
router.post('/admin/reorder', adminAuth, validateReorder, reorderNavigationMenus);
router.patch('/admin/:id/toggle', adminAuth, toggleNavigationMenuStatus);

module.exports = router;
