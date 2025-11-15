import mongoose from 'mongoose';

const connectToDB = async () => { 
    try {
        await mongoose.connect(process.env.MONGO_URI)
        console.log('Connected to MongoDB successfully');

    } catch (error) { 
        console.error('Error connecting to the database:', error);
    }
}

export default connectToDB;