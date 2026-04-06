const Complaint = require('../models/Complaint');
const ComplaintHistory = require('../models/ComplaintHistory');
const User = require('../models/User');
const Notification = require('../models/Notification');

const buildStatusNotification = (complaint, status, rejectionReason) => {
  let notifType = 'status_update';
  let notifMessage = `Your report "${complaint.title}" status changed to ${status.replace('_', ' ')}.`;

  if (status === 'rejected') {
    notifType = 'rejected';
    notifMessage = `Your report was rejected. Reason: ${rejectionReason || 'Duplicate or invalid report.'}`;
  } else if (status === 'in_progress') {
    notifMessage = 'Your report has been verified and assigned to a field contractor. Repairs are in progress!';
  } else if (status === 'resolved') {
    notifMessage = complaint.resolutionImage?.url
      ? 'Great news! Your reported pothole has been repaired and a proof photo has been attached.'
      : 'Great news! Your reported pothole has been successfully repaired!';
  } else if (status === 'approved') {
    notifMessage = 'Your report has been formally verified and approved by the municipality!';
  }

  return { notifType, notifMessage };
};

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private (Admin)
const getDashboardStats = async (req, res) => {
  try {
    // Basic statistics
    const totalComplaints = await Complaint.countDocuments();
    const pendingComplaints = await Complaint.countDocuments({ status: 'pending' });
    const inProgressComplaints = await Complaint.countDocuments({ status: 'in_progress' });
    const resolvedComplaints = await Complaint.countDocuments({ status: 'resolved' });
    const rejectedComplaints = await Complaint.countDocuments({ status: 'rejected' });

    // Severity breakdown
    const severityStats = await Complaint.aggregate([
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      }
    ]);

    // Category breakdown
    const categoryStats = await Complaint.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    // Office workload
    const officeStats = await Complaint.aggregate([
      {
        $group: {
          _id: '$currentOffice',
          count: { $sum: 1 },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          inProgress: {
            $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
          }
        }
      }
    ]);

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentActivity = await ComplaintHistory.find({
      timestamp: { $gte: thirtyDaysAgo }
    })
    .populate('actionBy', 'username')
    .sort({ timestamp: -1 })
    .limit(10);

    // Average resolution time
    const resolvedComplaintsData = await Complaint.find({
      status: 'resolved',
      'resolution.resolvedAt': { $exists: true }
    });

    let totalResolutionTime = 0;
    let resolvedCount = 0;

    resolvedComplaintsData.forEach(complaint => {
      if (complaint.resolution && complaint.resolution.duration) {
        totalResolutionTime += complaint.resolution.duration;
        resolvedCount++;
      }
    });

    const avgResolutionTime = resolvedCount > 0 ? (totalResolutionTime / resolvedCount).toFixed(1) : 0;

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalComplaints,
          pendingComplaints,
          inProgressComplaints,
          resolvedComplaints,
          rejectedComplaints,
          avgResolutionTime: `${avgResolutionTime} days`
        },
        severityBreakdown: severityStats,
        categoryBreakdown: categoryStats,
        officeWorkload: officeStats,
        recentActivity
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during dashboard stats retrieval'
    });
  }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private (Admin)
const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;

    let query = {};

    // Apply filters
    if (req.query.role) query.role = req.query.role;
    if (req.query.isActive !== undefined) query.isActive = req.query.isActive === 'true';
    if (req.query.office) query.office = req.query.office;

    // Search
    if (req.query.search) {
      query.$or = [
        { username: new RegExp(req.query.search, 'i') },
        { email: new RegExp(req.query.search, 'i') },
        { 'profile.firstName': new RegExp(req.query.search, 'i') },
        { 'profile.lastName': new RegExp(req.query.search, 'i') }
      ];
    }

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(startIndex);

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during users retrieval'
    });
  }
};

// @desc    Update user status
// @route   PUT /api/admin/users/:id/status
// @access  Private (Admin)
const updateUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: user
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during user status update'
    });
  }
};

// @desc    Get system settings
// @route   GET /api/admin/settings
// @access  Private (Admin)
const getSystemSettings = async (req, res) => {
  try {
    // In a real application, these would be stored in a database
    const settings = {
      systemStatus: 'active',
      maintenanceMode: false,
      maxFileSize: '10MB',
      allowedFileTypes: ['image/jpeg', 'image/png', 'image/webp'],
      autoAssignment: true,
      notificationSettings: {
        emailNotifications: true,
        smsNotifications: false,
        pushNotifications: true
      },
      complaintSettings: {
        autoCategorize: true,
        priorityThresholds: {
          high: 50,    // upvotes
          urgent: 100  // upvotes
        }
      }
    };

    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during settings retrieval'
    });
  }
};

// @desc    Update system settings
// @route   PUT /api/admin/settings
// @access  Private (Admin)
const updateSystemSettings = async (req, res) => {
  try {
    // In a real application, save to database
    const updatedSettings = req.body;

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: updatedSettings
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during settings update'
    });
  }
};

// @desc    Get audit logs
// @route   GET /api/admin/audit-logs
// @access  Private (Admin)
const getAuditLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const startIndex = (page - 1) * limit;

    let query = {};

    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      query.timestamp = {};
      if (req.query.startDate) query.timestamp.$gte = new Date(req.query.startDate);
      if (req.query.endDate) query.timestamp.$lte = new Date(req.query.endDate);
    }

    // Action filter
    if (req.query.action) query.action = req.query.action;

    // User filter
    if (req.query.userId) query.actionBy = req.query.userId;

    const logs = await ComplaintHistory.find(query)
      .populate('actionBy', 'username role')
      .populate('complaint', 'complaintId title')
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(startIndex);

    const total = await ComplaintHistory.countDocuments(query);

    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during audit logs retrieval'
    });
  }
};

// @desc    Bulk operations on complaints
// @route   POST /api/admin/bulk-operation
// @access  Private (Admin)
const bulkOperation = async (req, res) => {
  try {
    const { operation, complaintIds, data } = req.body;

    if (!operation || !complaintIds || !Array.isArray(complaintIds)) {
      return res.status(400).json({
        success: false,
        message: 'Operation and complaint IDs are required'
      });
    }

    const results = [];
    const errors = [];

    for (const complaintId of complaintIds) {
      try {
        const complaint = await Complaint.findOne({
          $or: [
            { _id: complaintId },
            { complaintId }
          ]
        });

        if (!complaint) {
          errors.push({ complaintId, error: 'Complaint not found' });
          continue;
        }

        switch (operation) {
          case 'update_status':
            if (!data.status) {
              errors.push({ complaintId, error: 'Status is required' });
              continue;
            }
            
            const prevStatus = complaint.status;
            complaint.status = data.status;
            if (data.status === 'resolved') {
              complaint.resolution = {
                resolvedAt: new Date(),
                resolvedBy: req.user._id,
                resolution: data.remarks || 'Bulk resolved',
                duration: Math.floor((Date.now() - complaint.createdAt) / (1000 * 60 * 60 * 24))
              };
            }
            await complaint.save();

            // Fire Notification for status change
            if (prevStatus !== data.status) {
              try {
                let notifType = 'status_update';
                let notifMessage = `Your report "${complaint.title}" status changed to ${data.status.replace('_', ' ')}.`;
                if (data.status === 'rejected') {
                  notifType = 'rejected';
                  notifMessage = `Your report was rejected. Reason: Bulk rejected by admin.`;
                } else if (data.status === 'in_progress') {
                  notifMessage = `Your report has been verified and assigned. Repairs are in progress!`;
                } else if (data.status === 'resolved') {
                  notifMessage = `Great news! Your reported pothole has been successfully repaired!`;
                } else if (data.status === 'approved') {
                  notifMessage = `Your report has been formally verified and approved by the municipality!`;
                }

                await Notification.create({
                  user: complaint.complainant,
                  title: `Report Status: ${data.status.toUpperCase()}`,
                  message: notifMessage,
                  type: notifType,
                  relatedComplaint: complaint._id
                });
              } catch (notifErr) { console.error('Bulk update notification error:', notifErr); }
            }
            break;

          case 'update_priority':
            if (!data.priority) {
              errors.push({ complaintId, error: 'Priority is required' });
              continue;
            }
            complaint.priority = data.priority;
            await complaint.save();
            break;

          case 'delete':
            await Complaint.findByIdAndDelete(complaint._id);
            break;

          default:
            errors.push({ complaintId, error: 'Invalid operation' });
            continue;
        }

        // Add to history (except for delete)
        if (operation !== 'delete') {
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
            actionByRole: 'admin',
            remarks: `Bulk operation: ${operation}`
          });
        }

        results.push({ complaintId, success: true });
      } catch (error) {
        errors.push({ complaintId, error: error.message });
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk operation completed. ${results.length} successful, ${errors.length} failed.`,
      data: {
        results,
        errors
      }
    });
  } catch (error) {
    console.error('Bulk operation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during bulk operation'
    });
  }
};

// @desc    Update a complaint status from the admin workflow
// @route   PUT /api/admin/complaints/:id/status
// @access  Private (Admin)
const updateComplaintWorkflowStatus = async (req, res) => {
  try {
    const { status, remarks, rejectionReason } = req.body;

    if (!status || !['pending', 'approved', 'in_progress', 'resolved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'A valid status is required'
      });
    }

    if (status === 'rejected' && !rejectionReason?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required when rejecting a report'
      });
    }

    if (status === 'resolved' && !req.file) {
      return res.status(400).json({
        success: false,
        message: 'Proof image is required when resolving a report'
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

    const previousState = {
      status: complaint.status,
      office: complaint.currentOffice,
      officer: complaint.currentOfficer
    };

    complaint.status = status;

    if (status !== 'pending') {
      if (!complaint.currentOfficer) {
        complaint.currentOfficer = req.user._id;
      }
      if (!complaint.currentOffice) {
        complaint.currentOffice = req.user.office || 'Municipal Office';
      }
    }

    if (status === 'rejected') {
      complaint.rejectionReason = rejectionReason.trim();
    } else if (complaint.rejectionReason) {
      complaint.rejectionReason = undefined;
    }

    if (status === 'resolved') {
      complaint.resolution = {
        resolvedAt: new Date(),
        resolvedBy: req.user._id,
        resolution: remarks || 'Complaint resolved by admin',
        duration: Math.max(0, Math.floor((Date.now() - complaint.createdAt) / (1000 * 60 * 60 * 24)))
      };

      if (req.file) {
        const baseUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
        complaint.resolutionImage = {
          url: `${baseUrl}/uploads/${req.file.filename}`,
          filename: req.file.filename,
          uploadedAt: new Date()
        };
      }
    }

    await complaint.save();

    if (status !== previousState.status) {
      const { notifType, notifMessage } = buildStatusNotification(complaint, status, rejectionReason);
      await Notification.create({
        user: complaint.complainant,
        title: `Report Status: ${status.toUpperCase()}`,
        message: notifMessage,
        type: notifType,
        relatedComplaint: complaint._id
      });
    }

    await ComplaintHistory.addHistoryEntry({
      complaintId: complaint.complaintId,
      complaint: complaint._id,
      previousStatus: previousState.status,
      previousOffice: previousState.office,
      previousOfficer: previousState.officer,
      newStatus: complaint.status,
      newOffice: complaint.currentOffice,
      newOfficer: complaint.currentOfficer,
      action: status === 'resolved' ? 'resolved' : status === 'rejected' ? 'rejected' : 'status_updated',
      actionBy: req.user._id,
      actionByRole: 'admin',
      remarks: remarks || (status === 'rejected' ? rejectionReason : `Status updated to ${status}`),
      priority: complaint.priority
    });

    await complaint.populate('complainant', 'username profile.firstName profile.lastName');
    await complaint.populate('currentOfficer', 'username profile.firstName profile.lastName office department');

    res.status(200).json({
      success: true,
      message: 'Complaint status updated successfully',
      data: complaint
    });
  } catch (error) {
    console.error('Admin workflow status update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during admin status update'
    });
  }
};

module.exports = {
  getDashboardStats,
  getUsers,
  updateUserStatus,
  getSystemSettings,
  updateSystemSettings,
  getAuditLogs,
  bulkOperation,
  updateComplaintWorkflowStatus
};
