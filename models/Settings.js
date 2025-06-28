const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: ['payment', 'general', 'notification', 'delivery', 'security'],
    index: true
  },
  key: {
    type: String,
    required: true,
    index: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  isPublic: {
    type: Boolean,
    default: false // Whether this setting can be accessed by non-admin users
  },
  lastModifiedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
settingsSchema.index({ category: 1, key: 1 }, { unique: true });

// Static method to get settings by category
settingsSchema.statics.getByCategory = async function(category) {
  const settings = await this.find({ category });
  const result = {};
  settings.forEach(setting => {
    result[setting.key] = setting.value;
  });
  return result;
};

// Static method to set a setting
settingsSchema.statics.setSetting = async function(category, key, value, userId = null) {
  return await this.findOneAndUpdate(
    { category, key },
    { 
      value, 
      lastModifiedBy: userId,
      updatedAt: new Date()
    },
    { 
      upsert: true, 
      new: true 
    }
  );
};

// Static method to get all payment settings formatted for frontend
settingsSchema.statics.getPaymentSettings = async function() {
  const paymentSettings = await this.getByCategory('payment');
  
  // Return with defaults if not set
  return {
    bkash: {
      enabled: paymentSettings.bkashEnabled || false,
      merchantNumber: paymentSettings.bkashMerchantNumber || '',
      apiKey: paymentSettings.bkashApiKey || ''
    },
    nagad: {
      enabled: paymentSettings.nagadEnabled || false,
      merchantNumber: paymentSettings.nagadMerchantNumber || '',
      apiKey: paymentSettings.nagadApiKey || ''
    },
    rocket: {
      enabled: paymentSettings.rocketEnabled || false,
      merchantNumber: paymentSettings.rocketMerchantNumber || '',
      apiKey: paymentSettings.rocketApiKey || ''
    },
    upay: {
      enabled: paymentSettings.upayEnabled || false,
      merchantNumber: paymentSettings.upayMerchantNumber || '',
      apiKey: paymentSettings.upayApiKey || ''
    },
    cashOnDelivery: {
      enabled: paymentSettings.codEnabled !== false, // Default to true
      deliveryCharge: paymentSettings.deliveryCharge || 60
    }
  };
};

// Static method to save payment settings from frontend format
settingsSchema.statics.savePaymentSettings = async function(settings, userId = null) {
  const updates = [
    // bKash settings
    { category: 'payment', key: 'bkashEnabled', value: settings.bkash?.enabled || false },
    { category: 'payment', key: 'bkashMerchantNumber', value: settings.bkash?.merchantNumber || '' },
    { category: 'payment', key: 'bkashApiKey', value: settings.bkash?.apiKey || '' },
    
    // Nagad settings
    { category: 'payment', key: 'nagadEnabled', value: settings.nagad?.enabled || false },
    { category: 'payment', key: 'nagadMerchantNumber', value: settings.nagad?.merchantNumber || '' },
    { category: 'payment', key: 'nagadApiKey', value: settings.nagad?.apiKey || '' },
    
    // Rocket settings
    { category: 'payment', key: 'rocketEnabled', value: settings.rocket?.enabled || false },
    { category: 'payment', key: 'rocketMerchantNumber', value: settings.rocket?.merchantNumber || '' },
    { category: 'payment', key: 'rocketApiKey', value: settings.rocket?.apiKey || '' },
    
    // Upay settings
    { category: 'payment', key: 'upayEnabled', value: settings.upay?.enabled || false },
    { category: 'payment', key: 'upayMerchantNumber', value: settings.upay?.merchantNumber || '' },
    { category: 'payment', key: 'upayApiKey', value: settings.upay?.apiKey || '' },
    
    // Cash on Delivery settings
    { category: 'payment', key: 'codEnabled', value: settings.cashOnDelivery?.enabled !== false },
    { category: 'payment', key: 'deliveryCharge', value: settings.cashOnDelivery?.deliveryCharge || 60 }
  ];

  const promises = updates.map(({ category, key, value }) => 
    this.setSetting(category, key, value, userId)
  );

  await Promise.all(promises);
  return await this.getPaymentSettings();
};

module.exports = mongoose.model('Settings', settingsSchema); 