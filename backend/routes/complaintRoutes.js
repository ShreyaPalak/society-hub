const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const ctrl = require('../controllers/complaintController');

const router = express.Router();

router.use(authenticate); // every complaint route requires a logged-in user

// Resident-only
router.post('/', authorize('resident'), upload.single('photo'), asyncHandler(ctrl.create));
router.get('/mine', authorize('resident'), asyncHandler(ctrl.listMine));

// Admin-only
router.get('/', authorize('admin'), asyncHandler(ctrl.listAll));
router.get('/metrics', authorize('admin'), asyncHandler(ctrl.metrics));
router.patch('/:id/status', authorize('admin'), asyncHandler(ctrl.updateStatus));
router.patch('/:id/priority', authorize('admin'), asyncHandler(ctrl.updatePriority));

// Shared (controller enforces resident-can-only-see-own)
router.get('/:id', asyncHandler(ctrl.getOne));

module.exports = router;
