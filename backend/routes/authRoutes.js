const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/authController');

const router = express.Router();

router.post('/register', asyncHandler(ctrl.register));
router.post('/login', asyncHandler(ctrl.login));
router.get('/me', authenticate, asyncHandler(ctrl.me));

module.exports = router;
