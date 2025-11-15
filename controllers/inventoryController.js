import InventoryModel from '../models/Inventory.js';

export const createInventory = async (req, res) => {
  try {
    const inventory = new InventoryModel(req.body);
    await inventory.save();
    res.status(201).json(inventory);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getInventories = async (req, res) => {
  try {
    const inventories = await InventoryModel.find();
    res.json(inventories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getInventoryById = async (req, res) => {
  try {
    const inventory = await InventoryModel.findById(req.params.id);
    if (!inventory) return res.status(404).json({ error: 'Inventory not found' });
    res.json(inventory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateInventory = async (req, res) => {
  try {
    const inventory = await InventoryModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!inventory) return res.status(404).json({ error: 'Inventory not found' });
    res.json(inventory);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteInventory = async (req, res) => {
  try {
    const inventory = await InventoryModel.findByIdAndDelete(req.params.id);
    if (!inventory) return res.status(404).json({ error: 'Inventory not found' });
    res.json({ message: 'Inventory deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
