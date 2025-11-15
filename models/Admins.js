import mongoose from "mongoose";

const AdminsSchema = new mongoose.Schema({
	username: { type: String, required: true, unique: true },
	email: { type: String, required: true, unique: true },
	password: { type: String, required: true, minlength: 6 },
	refreshToken: { type: String, select: false },
	role: { type: String, enum: ['superadmin', 'manager', 'staff'], default: 'manager' },
}, { timestamps: true });

const AdminModel = mongoose.model('Admins', AdminsSchema);
export default AdminModel;
