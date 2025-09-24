const mongoose = require('mongoose');

const navigationMenuSchema = new mongoose.Schema({
  title: {
    en: { type: String, required: true },
    bn: { type: String, required: true }
  },
  path: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: null
  },
  badge: {
    text: { type: String, default: null },
    color: { 
      type: String, 
      enum: ['red', 'orange', 'green', 'blue', 'purple'],
      default: 'red'
    }
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isExternal: {
    type: Boolean,
    default: false
  },
  target: {
    type: String,
    enum: ['_self', '_blank'],
    default: '_self'
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NavigationMenu',
    default: null
  },
  children: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NavigationMenu'
  }],
  permissions: [{
    type: String,
    enum: ['public', 'authenticated', 'admin', 'guest']
  }],
  cssClass: {
    type: String,
    default: ''
  },
  description: {
    en: { type: String, default: '' },
    bn: { type: String, default: '' }
  }
}, {
  timestamps: true
});

// Index for efficient queries
navigationMenuSchema.index({ order: 1, isActive: 1 });
navigationMenuSchema.index({ parentId: 1 });
navigationMenuSchema.index({ path: 1 });

// Virtual for full path with parent paths
navigationMenuSchema.virtual('fullPath').get(function() {
  if (this.isExternal) {
    return this.path;
  }
  return this.path;
});

// Method to get menu tree
navigationMenuSchema.statics.getMenuTree = async function() {
  const items = await this.find({ isActive: true })
    .sort({ order: 1, createdAt: 1 })
    .lean();
  
  const itemMap = new Map();
  const roots = [];
  
  // Create map of all items
  items.forEach(item => {
    itemMap.set(item._id.toString(), { ...item, children: [] });
  });
  
  // Build tree structure
  items.forEach(item => {
    if (item.parentId) {
      const parent = itemMap.get(item.parentId.toString());
      if (parent) {
        parent.children.push(itemMap.get(item._id.toString()));
      }
    } else {
      roots.push(itemMap.get(item._id.toString()));
    }
  });
  
  return roots;
};

// Method to get flat menu for simple navigation
navigationMenuSchema.statics.getFlatMenu = async function() {
  return await this.find({ isActive: true })
    .sort({ order: 1, createdAt: 1 })
    .select('title path icon badge order isExternal target permissions cssClass')
    .lean();
};

module.exports = mongoose.model('NavigationMenu', navigationMenuSchema);

