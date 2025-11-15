import mongoose from 'mongoose';

const UsersSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    Address: { type: String, required: true },
    phoneNumber: {
        type: String, required: true, unique: true, validate: {
            validator: function(v) {
                return /^\d{10}$/.test(v);
            },
            message: props => `${props.value} is not a valid 10-digit phone number!`
        }
    },
    password: { type: String, required: true, minlength: 6, maxlength: 64 },
    // confirmPassword is validated at the request level (Joi) and should not be stored
    // in the database. We do not keep confirmPassword in the schema to avoid
    // validation errors from Mongoose when creating users.
    // refresh token for rotation (httpOnly cookie value stored server-side)
    refreshToken: { type: String, select: false }
})
const UserModel = mongoose.model('Users', UsersSchema);
export default UserModel;