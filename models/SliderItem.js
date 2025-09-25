const mongoose = require('mongoose');

const sliderItemSchema = new mongoose.Schema({
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
  }
}, {
  timestamps: true
});

// Index for ordering
sliderItemSchema.index({ order: 1 });

module.exports = mongoose.model('SliderItem', sliderItemSchema); 