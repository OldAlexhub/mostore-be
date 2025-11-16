import mongoose from 'mongoose';

const AnnouncementSchema = new mongoose.Schema({
  text: { type: String, required: true },
  href: { type: String },
  active: { type: Boolean, default: true },
  startsAt: { type: Date },
  endsAt: { type: Date },
  priority: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const AnnouncementModel = mongoose.model('Announcements', AnnouncementSchema);
export default AnnouncementModel;
