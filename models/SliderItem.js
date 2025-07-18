const mongoose = require('mongoose');

const sliderItemSchema = new mongoose.Schema({
  title: {
    en: { type: String, required: true },
    bn: { type: String, required: true }
  },
  description: {
    en: { type: String, required: true },
    bn: { type: String, required: true }
  },
  image: {
    url: { type: String, required: true },
    public_id: { type: String, required: true }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  },
  linkUrl: {
    type: String,
    default: ''
  },
  buttonText: {
    en: { type: String, default: 'Learn More' },
    bn: { type: String, default: 'আরও জানুন' }
  }
}, {
  timestamps: true
});

// Index for ordering
sliderItemSchema.index({ order: 1 });

module.exports = mongoose.model('SliderItem', sliderItemSchema); 