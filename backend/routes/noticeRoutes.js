const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/noticeController');

const router = express.Router();

router.use(authenticate);

router.get('/', asyncHandler(ctrl.list)); // both roles read the notice board
router.post('/', authorize('admin'), asyncHandler(ctrl.create)); // admin-only write

module.exports = router;
