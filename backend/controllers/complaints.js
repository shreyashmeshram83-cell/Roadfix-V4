const { validationResult } = require('express-validator');
const Complaint = require('../models/Complaint');
const ComplaintHistory = require('../models/ComplaintHistory');
const Notification = require('../models/Notification');
const User = require('../models/User');
const geminiService = require('../services/geminiService');

const normalizeLocation = (location = {}) => {
  const latitude = Number(location?.coordinates?.latitude);
  const longitude = Number(location?.coordinates?.longitude);

  return {
    ...location,
    coordinates: {
      latitude,
      longitude
    },
    geo: Number.isFinite(latitude) && Number.isFinite(longitude)
      ? {
          type: 'Point',
          coordinates: [longitude, latitude]
        }
      : undefined
  };
};

// @desc    Create new complaint
// @route   POST /api/complaints
// @access  Private (Users)
const createComplaint = async (req, res) => {
  try {
    // guard against a missing user (protect should have set this)
    if (!req.user || !req.user._id) {
      // this can occur if the token is missing, expired or CORS blocked the header
      console.warn('createComplaint called without authenticated user');
      return res.status(401).json({
        success: false,
        message: 'Authentication required to submit a complaint'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      title,
      description,
      category,
      severity,
      location
    } = req.body;

    const aiAnalysis = req.body.aiAnalysis || {};
    if (aiAnalysis && aiAnalysis.isPothole === false) {
      return res.status(400).json({
        success: false,
        message: aiAnalysis.rejectionReason || 'Only real pothole or road-damage images can be submitted.'
      });
    }

    const normalizedLocation = normalizeLocation(location);

    let images = req.body.images || [];
    if (typeof images === 'string') {
      try { images = JSON.parse(images); } catch(e) { images = []; }
    }

    // Convert uploaded files to image objects
    if (req.files && req.files.length > 0) {
      const baseUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
      const uploadedImages = req.files.map(file => ({
        url: `${baseUrl}/uploads/${file.filename}`,
        filename: file.filename,
        uploadedAt: new Date()
      }));
      images = [...images, ...uploadedImages];
    }

    // Generate unique complaint ID
    const complaintId = await Complaint.generateComplaintId();

    // Create complaint
    const complaint = await Complaint.create({
      complaintId,
      title,
      description,
      category,
      severity,
      location: normalizedLocation,
      images: images || [],
      complainant: req.user._id,
      currentOffice: 'Municipal Office',
      aiAnalysis
    });

    // Add to history
    await ComplaintHistory.addHistoryEntry({
      complaintId,
      complaint: complaint._id,
      previousStatus: 'pending',
      previousOffice: 'User',
      newStatus: 'pending',
      newOffice: 'Municipal Office',
      action: 'submitted',
      actionBy: req.user._id,
      actionByRole: req.user.role,
      remarks: 'Complaint submitted by user'
    });

    // Populate complainant data
    await complaint.populate('complainant', 'username profile.firstName profile.lastName');

    // Notify user
    await Notification.create({
      user: req.user._id,
      title: 'Report Submitted',
      message: `Your pothole report "${title}" has been successfully submitted and is pending verification.`,
      type: 'system',
      relatedComplaint: complaint._id
    });

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully',
      data: complaint
    });
  } catch (error) {
    console.error('Create complaint error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during complaint creation'
    });
  }
};

// @desc    Get all complaints (with filters)
// @route   GET /api/complaints
// @access  Private
const getComplaints = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;

    // Build query
    let query = {};

    // Note: We intentionally don't filter regular users so they can see the full Community Feed.
    // Admin can see all as well.

    // Apply filters
    if (req.query.status) query.status = req.query.status;
    if (req.query.category) query.category = req.query.category;
    if (req.query.severity) query.severity = req.query.severity;
    if (req.query.priority) query.priority = req.query.priority;
    if (req.query.office) query.currentOffice = req.query.office;
    if (req.query.user_only === 'true' && req.user) query.complainant = req.user._id;

    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      query.createdAt = {};
      if (req.query.startDate) query.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) query.createdAt.$lte = new Date(req.query.endDate);
    }

    // Search by complaint ID or title
    if (req.query.search) {
      query.$or = [
        { complaintId: new RegExp(req.query.search, 'i') },
        { title: new RegExp(req.query.search, 'i') },
        { description: new RegExp(req.query.search, 'i') }
      ];
    }

    // Execute query
    const complaints = await Complaint.find(query)
      .populate('complainant', 'username profile.firstName profile.lastName')
      .populate('currentOfficer', 'username profile.firstName profile.lastName office department')
      .populate('comments.user', 'username profile.firstName profile.lastName')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(startIndex);

    // Get total count for pagination
    const total = await Complaint.countDocuments(query);

    // Transform complaints to convert ObjectIds to strings
    const transformedComplaints = complaints.map(complaint => ({
      ...complaint.toObject(),
      location: normalizeLocation(complaint.location),
      upvotedBy: complaint.upvotedBy.map(id => id.toString())
    }));

    res.status(200).json({
      success: true,
      data: transformedComplaints,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get complaints error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during complaint retrieval'
    });
  }
};

// @desc    Get single complaint
// @route   GET /api/complaints/:id
// @access  Private
const getComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findOne({
      $or: [
        { _id: req.params.id },
        { complaintId: req.params.id }
      ]
    })
    .populate('complainant', 'username profile.firstName profile.lastName email')
    .populate('currentOfficer', 'username profile.firstName profile.lastName office department')
    .populate('resolution.resolvedBy', 'username profile.firstName profile.lastName')
    .populate('comments.user', 'username profile.firstName profile.lastName');

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Check permissions (Wait, we allow all users to view any complaint for the Community Feed)
    // if (req.user.role === 'user' && complaint.complainant._id.toString() !== req.user._id.toString()) {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Not authorized to view this complaint'
    //   });
    // }

    // Transform complaint to convert ObjectIds to strings
    const transformedComplaint = {
      ...complaint.toObject(),
      location: normalizeLocation(complaint.location),
      upvotedBy: complaint.upvotedBy.map(id => id.toString())
    };

    res.status(200).json({
      success: true,
      data: transformedComplaint
    });
  } catch (error) {
    console.error('Get complaint error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during complaint retrieval'
    });
  }
};

// @desc    Get complaint timeline/history
// @route   GET /api/complaints/:id/timeline
// @access  Private
const getComplaintTimeline = async (req, res) => {
  try {
    const complaint = await Complaint.findOne({
      $or: [
        { _id: req.params.id },
        { complaintId: req.params.id }
      ]
    });

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Check permissions
    // Note: Community feed allows viewing all timelines
    // if (req.user.role === 'user' && complaint.complainant.toString() !== req.user._id.toString()) {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Not authorized to view this timeline'
    //   });
    // }

    const timeline = await ComplaintHistory.getComplaintTimeline(complaint.complaintId);

    res.status(200).json({
      success: true,
      data: timeline
    });
  } catch (error) {
    console.error('Get timeline error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during timeline retrieval'
    });
  }
};

// @desc    Update complaint status
// @route   PUT /api/complaints/:id/status
// @access  Private (Admin)
const updateComplaintStatus = async (req, res) => {
  try {
    const { status, remarks, priority, office } = req.body;

    const complaint = await Complaint.findOne({
      $or: [
        { _id: req.params.id },
        { complaintId: req.params.id }
      ]
    });

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Store previous state
    const previousState = {
      status: complaint.status,
      office: complaint.currentOffice,
      officer: complaint.currentOfficer
    };

    // Update complaint
    complaint.status = status;
    if (priority) complaint.priority = priority;
    if (office) complaint.currentOffice = office;
    if (status !== 'pending' && !complaint.currentOfficer) complaint.currentOfficer = req.user._id;
    if (req.body.rejectionReason) complaint.rejectionReason = req.body.rejectionReason;

    // Handle resolution
    if (status === 'resolved') {
      complaint.resolution = {
        resolvedAt: new Date(),
        resolvedBy: req.user._id,
        resolution: remarks || 'Complaint resolved',
        duration: Math.floor((Date.now() - complaint.createdAt) / (1000 * 60 * 60 * 24))
      };
      // Capture resolution image if uploaded
      if (req.file) {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        complaint.resolutionImage = {
          url: `${baseUrl}/uploads/${req.file.filename}`,
          filename: req.file.filename,
          uploadedAt: new Date()
        };
      }
    }

    await complaint.save();

    // Trigger Notification Base on Status Action
    if (status !== previousState.status) {
      let notifMessage = `Your report "${complaint.title}" status changed to ${status}.`;
      let notifType = 'status_update';
      
      if (status === 'rejected') {
        notifMessage = `Your report was rejected. Reason: ${req.body.rejectionReason || 'Duplicate or invalid report.'}`;
        notifType = 'rejected';
      } else if (status === 'in_progress') {
        notifMessage = `Your report has been verified and assigned to a field contractor. Repairs are in progress!`;
      } else if (status === 'resolved') {
        notifMessage = `Great news! Your reported pothole has been successfully repaired!`;
      } else if (status === 'approved') {
        notifMessage = `Your report has been formally verified and approved by the municipality!`;
      }

      await Notification.create({
        user: complaint.complainant,
        title: `Report Status: ${status.toUpperCase()}`,
        message: notifMessage,
        type: notifType,
        relatedComplaint: complaint._id
      });
    }

    // Add to history
    await ComplaintHistory.addHistoryEntry({
      complaintId: complaint.complaintId,
      complaint: complaint._id,
      previousStatus: previousState.status,
      previousOffice: previousState.office,
      previousOfficer: previousState.officer,
      newStatus: status,
      newOffice: complaint.currentOffice,
      newOfficer: complaint.currentOfficer,
      action: status === 'resolved' ? 'resolved' : 'status_updated',
      actionBy: req.user._id,
      actionByRole: req.user.role,
      remarks: remarks || `Status updated to ${status}`,
      priority: complaint.priority
    });

    // Populate updated data
    await complaint.populate('currentOfficer', 'username profile.firstName profile.lastName office department');

    res.status(200).json({
      success: true,
      message: 'Complaint status updated successfully',
      data: complaint
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during status update'
    });
  }
};

// @desc    Add remarks to complaint
// @route   POST /api/complaints/:id/remarks
// @access  Private (Admin)
const addRemarks = async (req, res) => {
  try {
    const { remarks } = req.body;

    if (!remarks || !remarks.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Remarks are required'
      });
    }

    const complaint = await Complaint.findOne({
      $or: [
        { _id: req.params.id },
        { complaintId: req.params.id }
      ]
    });

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Add to history
    await ComplaintHistory.addHistoryEntry({
      complaintId: complaint.complaintId,
      complaint: complaint._id,
      previousStatus: complaint.status,
      previousOffice: complaint.currentOffice,
      previousOfficer: complaint.currentOfficer,
      newStatus: complaint.status,
      newOffice: complaint.currentOffice,
      newOfficer: complaint.currentOfficer,
      action: 'status_updated',
      actionBy: req.user._id,
      actionByRole: req.user.role,
      remarks: remarks.trim()
    });

    res.status(200).json({
      success: true,
      message: 'Remarks added successfully'
    });
  } catch (error) {
    console.error('Add remarks error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during remarks addition'
    });
  }
};

// @desc    Upvote complaint
// @route   POST /api/complaints/:id/upvote
// @access  Private (Users)
const upvoteComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findOne({
      $or: [
        { _id: req.params.id },
        { complaintId: req.params.id }
      ]
    });

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    const userId = req.user._id;
    const userIdStr = userId.toString();
    const hasUpvoted = complaint.upvotedBy.some(id => id.toString() === userIdStr);

    if (hasUpvoted) {
      // Remove upvote
      complaint.upvotes = Math.max(0, complaint.upvotes - 1);
      complaint.upvotedBy = complaint.upvotedBy.filter(id => id.toString() !== userIdStr);
    } else {
      // Add upvote
      complaint.upvotes += 1;
      complaint.upvotedBy.push(userId);
    }

    await complaint.save();

    if (!hasUpvoted && complaint.complainant.toString() !== userIdStr) {
      await Notification.create({
        user: complaint.complainant,
        title: 'New Upvote',
        message: 'Someone upvoted your pothole report!',
        type: 'upvote',
        relatedComplaint: complaint._id
      });
    }

    res.status(200).json({
      success: true,
      message: hasUpvoted ? 'Upvote removed' : 'Complaint upvoted',
      data: {
        upvotes: complaint.upvotes,
        upvotedBy: complaint.upvotedBy.map(id => id.toString()),
        hasUpvoted: !hasUpvoted
      }
    });
  } catch (error) {
    console.error('Upvote error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during upvote'
    });
  }
};

// @desc    Analyze uploaded image
// @route   POST /api/complaints/analyze
// @access  Private (Users)
const analyzeImage = async (req, res) => {
  try {
    const { base64Image } = req.body;
    
    if (!base64Image) {
      return res.status(400).json({
        success: false,
        message: 'No image data provided for analysis'
      });
    }

    const analysis = await geminiService.analyzePotholeImage(base64Image);

    res.status(200).json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Analyze image error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during image analysis'
    });
  }
};

// @desc    Add comment to complaint
// @route   POST /api/complaints/:id/comment
// @access  Private
const addComment = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Not found' });

    const newComment = {
      user: req.user._id,
      text: req.body.text
    };

    complaint.comments.push(newComment);
    await complaint.save();

    await complaint.populate('comments.user', 'username profile.firstName profile.lastName');

    if (complaint.complainant.toString() !== req.user._id.toString()) {
      await Notification.create({
        user: complaint.complainant,
        title: 'New Comment',
        message: `Someone commented on your report: "${complaint.title}"`,
        type: 'new_comment',
        relatedComplaint: complaint._id
      });
    }

    res.status(200).json({ success: true, data: complaint.comments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error adding comment' });
  }
};

// @desc    Dismantle/Delete a fake or spam complaint
// @route   DELETE /api/complaints/:id/dismantle
// @access  Private (Admin)
const dismantleComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Not found' });

    const reason = req.body.reason || 'Violation of community guidelines or duplicate.';

    // Notify user before deletion or right after (since we need the user ref)
    await Notification.create({
      user: complaint.complainant,
      title: 'Report Removed',
      message: `Your report "${complaint.title}" was dismantled by admin. Reason: ${reason}`,
      type: 'rejected'
    });

    await ComplaintHistory.deleteMany({ complaint: complaint._id });
    await complaint.deleteOne();

    res.status(200).json({ success: true, message: 'Complaint permanently dismantled and user notified.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error dismantling complaint' });
  }
};

// @desc    Delete own complaint (user)
// @route   DELETE /api/complaints/:id
// @access  Private (owner only)
const deleteOwnComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Report not found' });

    // Only the complainant who created it can delete it
    if (complaint.complainant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only delete your own reports' });
    }

    await ComplaintHistory.deleteMany({ complaint: complaint._id });
    await complaint.deleteOne();

    res.status(200).json({ success: true, message: 'Your report has been deleted.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error deleting report' });
  }
};

module.exports = {
  createComplaint,
  getComplaints,
  getComplaint,
  getComplaintTimeline,
  updateComplaintStatus,
  addRemarks,
  upvoteComplaint,
  analyzeImage,
  addComment,
  dismantleComplaint,
  deleteOwnComplaint
};
