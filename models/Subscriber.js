const mongoose = require('mongoose');
const { randomUUID } = require('crypto');

const SubscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
      unique: true,
      index: true
    },
    name: {
      type: String,
      trim: true
    },
    consent: {
      type: Boolean,
      default: false
    },
    source: {
      type: String,
      enum: ['footer', 'checkout', 'account', 'import', 'other'],
      default: 'footer'
    },
    unsubscribedAt: {
      type: Date,
      default: null
    },
    unsubscribeToken: {
      type: String,
      default: () => randomUUID(),
      index: true,
      unique: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Subscriber', SubscriberSchema);


