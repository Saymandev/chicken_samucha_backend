const HeroContent = require('../models/HeroContent');
const SliderItem = require('../models/SliderItem');
const { deleteImage } = require('../middleware/upload');

// Get hero content
const getHeroContent = async (req, res) => {
  try {
    const heroContent = await HeroContent.findOne({ isActive: true })
      .sort({ displayOrder: 1 });

    if (!heroContent) {
      return res.status(404).json({
        success: false,
        message: 'Hero content not found'
      });
    }

    res.json({
      success: true,
      heroContent
    });
  } catch (error) {
    console.error('Get hero content error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Update hero content (Admin)
const updateHeroContent = async (req, res) => {
  try {
    const updateData = req.body;

    // Handle image upload
    if (req.file) {
      // Delete old image if exists
      const existingHero = await HeroContent.findOne({ isActive: true });
      if (existingHero && existingHero.heroImage && existingHero.heroImage.public_id) {
        try {
          await deleteImage(existingHero.heroImage.public_id);
        } catch (err) {
          console.error('Error deleting old hero image:', err);
        }
      }

      updateData.heroImage = {
        public_id: req.file.filename,
        url: req.file.path
      };
    }

    let heroContent = await HeroContent.findOne({ isActive: true });

    if (heroContent) {
      heroContent = await HeroContent.findByIdAndUpdate(
        heroContent._id,
        updateData,
        { new: true, runValidators: true }
      );
    } else {
      heroContent = await HeroContent.create({ ...updateData, isActive: true });
    }

    res.json({
      success: true,
      message: 'Hero content updated successfully',
      heroContent
    });
  } catch (error) {
    console.error('Update hero content error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get slider items
const getSliderItems = async (req, res) => {
  try {
    const sliderItems = await SliderItem.find({ isActive: true })
      .sort({ order: 1 });

    res.json({
      success: true,
      count: sliderItems.length,
      sliderItems
    });
  } catch (error) {
    console.error('Get slider items error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Create slider item (Admin)
const createSliderItem = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Image is required'
      });
    }

    const sliderData = {
      ...req.body,
      image: {
        public_id: req.file.filename,
        url: req.file.path
      }
    };

    // Set display order if not provided
    if (!sliderData.order) {
      const lastItem = await SliderItem.findOne().sort({ order: -1 });
      sliderData.order = lastItem ? lastItem.order + 1 : 1;
    }

    const sliderItem = await SliderItem.create(sliderData);

    res.status(201).json({
      success: true,
      message: 'Slider item created successfully',
      sliderItem
    });
  } catch (error) {
    console.error('Create slider item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Update slider item (Admin)
const updateSliderItem = async (req, res) => {
  try {
    let sliderItem = await SliderItem.findById(req.params.id);

    if (!sliderItem) {
      return res.status(404).json({
        success: false,
        message: 'Slider item not found'
      });
    }

    const updateData = req.body;

    // Handle image upload
    if (req.file) {
      // Delete old image
      if (sliderItem.image && sliderItem.image.public_id) {
        try {
          await deleteImage(sliderItem.image.public_id);
        } catch (err) {
          console.error('Error deleting old slider image:', err);
        }
      }

      updateData.image = {
        public_id: req.file.filename,
        url: req.file.path
      };
    }

    sliderItem = await SliderItem.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Slider item updated successfully',
      sliderItem
    });
  } catch (error) {
    console.error('Update slider item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Delete slider item (Admin)
const deleteSliderItem = async (req, res) => {
  try {
    const sliderItem = await SliderItem.findById(req.params.id);

    if (!sliderItem) {
      return res.status(404).json({
        success: false,
        message: 'Slider item not found'
      });
    }

    // Delete image from Cloudinary
    if (sliderItem.image && sliderItem.image.public_id) {
      try {
        await deleteImage(sliderItem.image.public_id);
      } catch (err) {
        console.error('Error deleting slider image:', err);
      }
    }

    await SliderItem.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Slider item deleted successfully'
    });
  } catch (error) {
    console.error('Delete slider item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Reorder slider items (Admin)
const reorderSliderItems = async (req, res) => {
  try {
    const { items } = req.body; // Array of { id, order }

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'Items array is required'
      });
    }

    // Update order for each item
    const updatePromises = items.map(item => 
      SliderItem.findByIdAndUpdate(item.id, { order: item.order })
    );

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: 'Slider items reordered successfully'
    });
  } catch (error) {
    console.error('Reorder slider items error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get public payment and delivery settings (for customers)
const getPublicPaymentSettings = async (req, res) => {
  try {
    const Settings = require('../models/Settings');
    const paymentSettings = await Settings.getPaymentSettings();
    const deliverySettings = await Settings.getByCategory('delivery');
    const generalSettings = await Settings.getByCategory('general');
    
    // Return only public information that customers need
    const publicSettings = {
      bkash: {
        enabled: paymentSettings.bkash?.enabled || false,
        merchantNumber: paymentSettings.bkash?.merchantNumber || '01234567890'
      },
      nagad: {
        enabled: paymentSettings.nagad?.enabled || false,
        merchantNumber: paymentSettings.nagad?.merchantNumber || '01234567891'
      },
      rocket: {
        enabled: paymentSettings.rocket?.enabled || false,
        merchantNumber: paymentSettings.rocket?.merchantNumber || '01234567892'
      },
      upay: {
        enabled: paymentSettings.upay?.enabled || false,
        merchantNumber: paymentSettings.upay?.merchantNumber || '01234567893'
      },
      cashOnDelivery: {
        enabled: paymentSettings.cashOnDelivery?.enabled !== false, // Default to true
        deliveryCharge: paymentSettings.cashOnDelivery?.deliveryCharge || 60
      },
      freeDeliveryThreshold: deliverySettings?.freeDeliveryThreshold ?? 500,
      // Normalized delivery charge used by checkout (prefers general setting)
      deliveryCharge: (generalSettings?.deliveryCharge ?? paymentSettings.cashOnDelivery?.deliveryCharge) || 60
    };

    res.json({
      success: true,
      settings: publicSettings
    });
  } catch (error) {
    console.error('Get public payment settings error:', error);
    // Return default settings if database fails
    res.json({
      success: true,
      settings: {
        bkash: { enabled: true, merchantNumber: '01234567890' },
        nagad: { enabled: true, merchantNumber: '01234567891' },
        rocket: { enabled: true, merchantNumber: '01234567892' },
        upay: { enabled: false, merchantNumber: '01234567893' },
        cashOnDelivery: { enabled: true, deliveryCharge: 60 },
        freeDeliveryThreshold: 500
      }
    });
  }
};

module.exports = {
  getHeroContent,
  updateHeroContent,
  getSliderItems,
  createSliderItem,
  updateSliderItem,
  deleteSliderItem,
  reorderSliderItems,
  getPublicPaymentSettings
}; 