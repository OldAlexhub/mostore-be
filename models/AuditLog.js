import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema({
  action: { type: String, required: true }, // e.g. 'admin.create', 'admin.delete', 'admin.role_change'
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'Admins' },
  actorUsername: { type: String },
  target: { type: mongoose.Schema.Types.ObjectId },
  targetUsername: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
  ip: { type: String },
}, { timestamps: true });

const AuditLogModel = mongoose.model('AuditLog', AuditLogSchema);
export default AuditLogModel;
