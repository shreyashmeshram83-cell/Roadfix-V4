const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  complaintId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substr(2, 5);
      return `RF${timestamp}${random}`.toUpperCase();
    }
  },
  title: {
    type: String,
    required: [true, 'Complaint title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Complaint description is required'],
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  category: {
    type: String,
    required: [true, 'Complaint category is required'],
    enum: ['pothole', 'street_light', 'water_supply', 'drainage', 'traffic_signal', 'other'],
    default: 'other'
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'in_progress', 'resolved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },

  // Location information
  location: {
    address: {
      type: String,
      required: [true, 'Location address is required']
    },
    coordinates: {
      latitude: {
        type: Number,
        required: [true, 'Latitude is required'],
        min: -90,
        max: 90
      },
      longitude: {
        type: Number,
        required: [true, 'Longitude is required'],
        min: -180,
        max: 180
      }
    },
    geo: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        default: undefined
      }
    },
    city: String,
    state: String,
    pincode: String
  },

  // Current assignment
  currentOffice: {
    type: String,
    required: true,
    default: 'Municipal Office'
  },
  currentOfficer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Media attachments
  images: [{
    url: {
      type: String,
      required: true
    },
    filename: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Complaint metadata
  complainant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  upvotes: {
    type: Number,
    default: 0
  },
  upvotedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    text: {
      type: String,
      required: true,
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // AI Analysis
  aiAnalysis: {
    isPothole: Boolean,
    severity: String,
    estimatedCost: String,
    confidence: Number,
    analyzedAt: Date
  },

  // Resolution details
  resolutionImage: {
    url: String,
    filename: String,
    uploadedAt: Date
  },
  resolution: {
    resolvedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolution: String,
    cost: Number,
    duration: Number // in days
  },

  // Timestamps
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
complaintSchema.index({ complainant: 1, createdAt: -1 });
complaintSchema.index({ status: 1, priority: -1, createdAt: -1 });
complaintSchema.index({ currentOffice: 1, status: 1 });
complaintSchema.index({ 'location.geo': '2dsphere' });
complaintSchema.index({ complaintId: 1 });

// Virtual for complaint age
complaintSchema.virtual('age').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for days since last update
complaintSchema.virtual('daysSinceUpdate').get(function() {
  return Math.floor((Date.now() - this.lastUpdated) / (1000 * 60 * 60 * 24));
});

// Static method to generate unique complaint ID
complaintSchema.statics.generateComplaintId = function() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `RF${timestamp}${random}`.toUpperCase();
};

// Pre-save middleware to update lastUpdated and generate complaintId
complaintSchema.pre('save', function(next) {
  if (!this.complaintId) {
    // Generate complaintId using the static method
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    this.complaintId = `RF${timestamp}${random}`.toUpperCase();
  }

  if (
    this.location &&
    this.location.coordinates &&
    typeof this.location.coordinates.latitude === 'number' &&
    typeof this.location.coordinates.longitude === 'number'
  ) {
    this.location.geo = {
      type: 'Point',
      coordinates: [
        this.location.coordinates.longitude,
        this.location.coordinates.latitude
      ]
    };
  }

  this.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model('Complaint', complaintSchema);
