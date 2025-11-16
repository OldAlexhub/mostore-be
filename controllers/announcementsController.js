import AnnouncementModel from '../models/Announcement.js';

export const getAnnouncement = async (req, res) => {
  try {
    const now = new Date();
    const anns = await AnnouncementModel.find({
      active: true,
      $or: [
        { startsAt: { $exists: false }, endsAt: { $exists: false } },
        { startsAt: { $exists: false }, endsAt: { $gte: now } },
        { startsAt: { $lte: now }, endsAt: { $exists: false } },
        { startsAt: { $lte: now }, endsAt: { $gte: now } }
      ]
    }).sort({ priority: -1, createdAt: -1 }).lean();

    res.json(anns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const listAnnouncements = async (req, res) => {
  try {
    const anns = await AnnouncementModel.find().sort({ priority: -1, createdAt: -1 }).lean();
    res.json(anns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createAnnouncement = async (req, res) => {
  try {
    const { text, href, active, startsAt, endsAt } = req.body;
    const ann = new AnnouncementModel({ text, href, active, startsAt, endsAt });
    await ann.save();
    res.status(201).json(ann);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const updateAnnouncement = async (req, res) => {
  try {
    const ann = await AnnouncementModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!ann) return res.status(404).json({ error: 'Announcement not found' });
    res.json(ann);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteAnnouncement = async (req, res) => {
  try {
    const ann = await AnnouncementModel.findByIdAndDelete(req.params.id);
    if (!ann) return res.status(404).json({ error: 'Announcement not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
