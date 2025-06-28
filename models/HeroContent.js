const mongoose = require('mongoose');

const heroContentSchema = new mongoose.Schema({
  title: {
    en: { type: String, required: true },
    bn: { type: String, required: true }
  },
  subtitle: {
    en: { type: String, required: true },
    bn: { type: String, required: true }
  },
  description: {
    en: { type: String, required: true },
    bn: { type: String, required: true }
  },
  buttonText: {
    en: { type: String, required: true },
    bn: { type: String, required: true }
  },
  backgroundImage: {
    url: { type: String, default: '' },
    public_id: { type: String, default: '' }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('HeroContent', heroContentSchema); 