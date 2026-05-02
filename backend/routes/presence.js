const express = require('express');
const { auth } = require('../middleware/auth');
const presenceService = require('../services/presenceService');

const router = express.Router();

router.post('/heartbeat', auth, (req, res) => {
  try {
    presenceService.heartbeat(req.user, { tabId: req.body?.tabId });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: 'Presence update failed' });
  }
});

router.get('/online', auth, (req, res) => {
  if (String(req.user?.role || '').toLowerCase() !== 'admin') {
    return res.status(403).json({ message: 'Only administrators can view who is online' });
  }
  try {
    const users = presenceService.getOnline();
    res.json({ data: users });
  } catch (e) {
    res.status(500).json({ message: 'Could not load online users' });
  }
});

module.exports = router;
