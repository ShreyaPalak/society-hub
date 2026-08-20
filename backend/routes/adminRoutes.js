const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/adminSettingsController');

const router = express.Router();

router.use(authenticate, authorize('admin'));

router.get('/settings/overdue-threshold', asyncHandler(ctrl.getThreshold));
router.put('/settings/overdue-threshold', asyncHandler(ctrl.updateThreshold));

module.exports = router;
