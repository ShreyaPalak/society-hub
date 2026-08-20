const ApiError = require('../utils/ApiError');
const { getOverdueThresholdDays, setOverdueThresholdDays } = require('../services/overdueService');

function getThreshold(req, res) {
  res.json({ overdue_threshold_days: getOverdueThresholdDays() });
}

function updateThreshold(req, res) {
  const { days } = req.body;
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    throw new ApiError(400, 'days must be a positive integer.');
  }
  const value = setOverdueThresholdDays(n, req.user.id);
  res.json({ overdue_threshold_days: value });
}

module.exports = { getThreshold, updateThreshold };
