import HeroSettings from '../models/HeroSettings.js';

const ensureSingleton = async () => {
  let doc = await HeroSettings.findOne();
  if (!doc) {
    doc = await HeroSettings.create({});
  }
  return doc;
};

export const getHeroSettings = async (req, res) => {
  try {
    const settings = await ensureSingleton();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const upsertHeroSettings = async (req, res) => {
  try {
    const payload = {
      header: req.body.header,
      sentence1: req.body.sentence1,
      sentence2: req.body.sentence2,
      sentence3: req.body.sentence3,
      contactLabel: req.body.contactLabel,
      whatsappNumber: req.body.whatsappNumber
    };
    const cleaned = Object.fromEntries(
      Object.entries(payload).map(([key, value]) => [key, typeof value === 'string' ? value : undefined])
    );
    const settings = await HeroSettings.findOneAndUpdate({}, cleaned, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    });
    res.json(settings);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
