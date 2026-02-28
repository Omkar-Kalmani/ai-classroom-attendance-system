const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const { getSummary } = require('../controllers/dashboard.controller');

const router = express.Router();

router.use(protect);
router.get('/summary', getSummary);

module.exports = router;
