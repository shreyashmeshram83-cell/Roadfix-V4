const express = require('express');
const { body } = require('express-validator');
const {
  getDashboardStats,
  getUsers,
  updateUserStatus,
  getSystemSettings,
  updateSystemSettings,
  getAuditLogs,
  bulkOperation,
  updateComplaintWorkflowStatus
} = require('../controllers/admin');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// All admin routes require admin authorization
router.use(protect);
router.use(authorize('admin'));

// Validation rules
const userStatusValidation = [
  body('isActive')
    .isBoolean()
    .withMessage('isActive must be a boolean value')
];

const bulkOperationValidation = [
  body('operation')
    .isIn(['update_status', 'update_priority', 'delete'])
    .withMessage('Invalid operation'),
  body('complaintIds')
    .isArray({ min: 1 })
    .withMessage('At least one complaint ID is required'),
  body('data')
    .optional()
    .isObject()
    .withMessage('Data must be an object')
];

// Routes
router.get('/dashboard', getDashboardStats);
router.get('/users', getUsers);
router.put('/users/:id/status', userStatusValidation, updateUserStatus);
router.put('/complaints/:id/status', upload.single('resolutionImage'), updateComplaintWorkflowStatus);
router.get('/settings', getSystemSettings);
router.put('/settings', updateSystemSettings);
router.get('/audit-logs', getAuditLogs);
router.post('/bulk-operation', bulkOperationValidation, bulkOperation);

module.exports = router;
