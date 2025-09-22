const mongoose = require('mongoose');

const AnnouncementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    linkUrl: { type: String },
    isActive: { type: Boolean, default: true, index: true },
    startsAt: { type: Date },
    endsAt: { type: Date }
  },
  { timestamps: true }
);

AnnouncementSchema.statics.getActive = async function () {
  const now = new Date();
  return this.findOne({
    isActive: true,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] }
    ]
  }).sort({ updatedAt: -1 });
};

module.exports = mongoose.model('Announcement', AnnouncementSchema);


