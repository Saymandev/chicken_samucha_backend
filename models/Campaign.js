const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    subject: { type: String, required: true },
    html: { type: String },
    text: { type: String },
    filters: {
      type: Object, // { source?: string[], joinedAfter?: Date, joinedBefore?: Date }
      default: {}
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'sending', 'sent', 'failed'],
      default: 'draft',
      index: true
    },
    scheduledFor: { type: Date },
    sentAt: { type: Date },
    stats: {
      recipients: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 }
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Campaign', CampaignSchema);


