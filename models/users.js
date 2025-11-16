import mongoose from 'mongoose';

const UsersSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    Address: { type: String, required: true },
    phoneNumber: {
        type: String,
        required: true,
        unique: true,
        validate: {
            validator: function(v) {
                // accept digits-only strings of reasonable length (7-15)
                return /^\d{7,15}$/.test(String(v || ''));
            },
            message: props => `${props.value} is not a valid phone number!`
        }
    },
    password: { type: String, required: true, minlength: 6, maxlength: 64 },
    // confirmPassword is validated at the request level (Joi) and should not be stored
    // in the database. We do not keep confirmPassword in the schema to avoid
    // validation errors from Mongoose when creating users.
    // refresh token for rotation (httpOnly cookie value stored server-side)
    refreshToken: { type: String, select: false }
})

// normalize phone numbers to digits-only before saving
UsersSchema.pre('save', function (next) {
    try {
        if (this.phoneNumber) {
            const raw = String(this.phoneNumber || '');
            const norm = raw.replace(/[^0-9+]/g, '');
            this.phoneNumber = norm.replace(/^\+/, '');
        }
        return next();
    } catch (err) {
        return next(err);
    }
});
const UserModel = mongoose.model('Users', UsersSchema);
export default UserModel;