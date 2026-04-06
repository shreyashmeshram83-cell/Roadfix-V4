const express = require('express');
const { body } = require('express-validator');
const {
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
} = require('../controllers/complaints');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Middleware to parse stringified JSON from FormData before validation
const parseFormDataJson = (req, res, next) => {
  if (req.body.location && typeof req.body.location === 'string') {
    try { req.body.location = JSON.parse(req.body.location); } catch (e) { console.error('location parse err', e) }
  }
  if (req.body.aiAnalysis && typeof req.body.aiAnalysis === 'string') {
    try { req.body.aiAnalysis = JSON.parse(req.body.aiAnalysis); } catch (e) { }
  }
  next();
};

// Validation rules
const createComplaintValidation = [
  body('title')
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters')
    .trim(),
  body('description')
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters')
    .trim(),
  body('category')
    .isIn(['pothole', 'street_light', 'water_supply', 'drainage', 'traffic_signal', 'other'])
    .withMessage('Invalid category'),
  body('severity')
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid severity'),
  body('location.address')
    .notEmpty()
    .withMessage('Location address is required'),
  body('location.coordinates.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  body('location.coordinates.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude')
];

const statusUpdateValidation = [
  body('status')
    .isIn(['pending', 'approved', 'in_progress', 'resolved', 'rejected'])
    .withMessage('Invalid status'),
  body('remarks')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Remarks cannot exceed 500 characters')
    .trim(),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority')
];

const remarksValidation = [
  body('remarks')
    .isLength({ min: 1, max: 500 })
    .withMessage('Remarks must be between 1 and 500 characters')
    .trim()
];

// Routes
router.post('/analyze', protect, analyzeImage);
router.post('/', protect, upload.array('images', 5), parseFormDataJson, createComplaintValidation, createComplaint);
router.get('/', getComplaints);
router.get('/:id', protect, getComplaint);
router.get('/:id/timeline', protect, getComplaintTimeline);

// Admin-only workflow routes
// We allow uploading a single file 'resolutionImage' for when status='resolved'
router.put('/:id/status', protect, authorize('admin'), upload.single('resolutionImage'), statusUpdateValidation, updateComplaintStatus);
router.post('/:id/remarks', protect, authorize('admin'), remarksValidation, addRemarks);
router.delete('/:id/dismantle', protect, authorize('admin'), dismantleComplaint);

// User routes
router.post('/:id/upvote', protect, upvoteComplaint);
router.post('/:id/comment', protect, addComment);
router.delete('/:id', protect, deleteOwnComplaint);

module.exports = router;
