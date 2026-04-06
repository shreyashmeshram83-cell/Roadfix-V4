const mongoose = require('mongoose');

const complaintHistorySchema = new mongoose.Schema({
  complaintId: {
    type: String,
    required: true,
    index: true
  },
  complaint: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Complaint',
    required: true
  },

  // Previous state
  previousStatus: {
    type: String,
    enum: ['pending', 'approved', 'in_progress', 'resolved', 'rejected'],
    required: true
  },
  previousOffice: {
    type: String,
    required: true
  },
  previousOfficer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // New state
  newStatus: {
    type: String,
    enum: ['pending', 'approved', 'in_progress', 'resolved', 'rejected'],
    required: true
  },
  newOffice: {
    type: String,
    required: true
  },
  newOfficer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Action details
  action: {
    type: String,
    required: true,
    enum: [
      'submitted',
      'status_updated',
      'resolved',
      'rejected',
      'reopened'
    ]
  },
  actionBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  actionByRole: {
    type: String,
    enum: ['user', 'admin'],
    required: true
  },

  // Additional information
  remarks: {
    type: String,
    trim: true,
    maxlength: [500, 'Remarks cannot exceed 500 characters']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent']
  },
  estimatedResolutionTime: Number, // in days

  // Metadata
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  ipAddress: String,
  userAgent: String
}, {
  timestamps: false, // We use timestamp field instead
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
complaintHistorySchema.index({ complaint: 1, timestamp: -1 });
complaintHistorySchema.index({ actionBy: 1, timestamp: -1 });
complaintHistorySchema.index({ complaintId: 1, timestamp: -1 });

// Virtual for formatted timestamp
complaintHistorySchema.virtual('formattedTimestamp').get(function () {
  return this.timestamp.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
});

// Virtual for action description
complaintHistorySchema.virtual('actionDescription').get(function () {
  const actions = {
    submitted: 'Complaint submitted',
    status_updated: 'Status updated',
    resolved: 'Complaint resolved',
    rejected: 'Complaint rejected',
    reopened: 'Complaint reopened'
  };
  return actions[this.action] || 'Action performed';
});

// Static method to get complaint timeline
complaintHistorySchema.statics.getComplaintTimeline = async function (complaintId) {
  return this.find({ complaintId })
    .populate('actionBy', 'username profile.firstName profile.lastName role')
    .populate('newOfficer', 'username profile.firstName profile.lastName')
    .populate('previousOfficer', 'username profile.firstName profile.lastName')
    .sort({ timestamp: 1 });
};

// Static method to add history entry
complaintHistorySchema.statics.addHistoryEntry = async function (historyData) {
  const history = new this(historyData);
  return history.save();
};

module.exports = mongoose.model('ComplaintHistory', complaintHistorySchema);
