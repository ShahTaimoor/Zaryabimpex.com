const mongoose = require('mongoose');

const breakSchema = new mongoose.Schema({
  type: { type: String, enum: ['break', 'lunch', 'other'], default: 'break' },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date },
  durationMinutes: { type: Number, default: 0 }
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  // Keep user field for backward compatibility and to track who clocked in (if employee has system access)
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  storeId: { type: String, index: true },
  deviceId: { type: String },
  clockedInBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Manager/admin who clocked in the employee
  clockInAt: { type: Date, required: true },
  clockOutAt: { type: Date },
  totalMinutes: { type: Number, default: 0 },
  breaks: { type: [breakSchema], default: [] },
  status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },
  notesIn: { type: String, default: '' },
  notesOut: { type: String, default: '' }
}, { timestamps: true });

attendanceSchema.methods.startBreak = function(type = 'break') {
  // Only allow when session is open and no active break
  if (this.status !== 'open') return false;
  const hasActive = this.breaks.some(b => !b.endedAt);
  if (hasActive) return false;
  this.breaks.push({ type, startedAt: new Date() });
  return true;
};

attendanceSchema.methods.endBreak = function() {
  const active = this.breaks.find(b => !b.endedAt);
  if (!active) return false;
  active.endedAt = new Date();
  const ms = active.endedAt - active.startedAt;
  active.durationMinutes = Math.max(0, Math.round(ms / 60000));
  return true;
};

attendanceSchema.methods.closeSession = function(notesOut) {
  if (this.status !== 'open') return false;
  // Auto-end any active break
  const active = this.breaks.find(b => !b.endedAt);
  if (active) {
    this.endBreak();
  }
  this.clockOutAt = new Date();
  const workedMs = this.clockOutAt - this.clockInAt;
  const totalBreakMinutes = this.breaks.reduce((s, b) => s + (b.durationMinutes || 0), 0);
  const workedMinutes = Math.max(0, Math.round(workedMs / 60000) - totalBreakMinutes);
  this.totalMinutes = workedMinutes;
  this.notesOut = notesOut || this.notesOut;
  this.status = 'closed';
  return true;
};

attendanceSchema.index({ employee: 1, createdAt: -1 });
attendanceSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Attendance', attendanceSchema);


