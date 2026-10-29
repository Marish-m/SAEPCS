import mongoose from 'mongoose';

const parentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true,
      index: true,
    },
    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        index: true,
      },
    ],
    relationship: {
      type: String,
      enum: ['Father', 'Mother', 'Guardian', 'Parent', 'Parent / Guardian'],
      default: 'Guardian',
    },
    occupation: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    alternatePhone: {
      type: String,
      default: '',
      trim: true,
    },
    isPhoneVerified: {
      type: Boolean,
      default: true,
    },
    notificationLanguagePreference: {
      type: String,
      enum: ['en', 'ta', 'hi'],
      default: 'en',
    },
    preferredNotificationMethod: {
      type: String,
      enum: ['Automatic', 'SMS', 'Email', 'Voice Call'],
      default: 'Automatic',
    },
    consentStatus: {
      type: String,
      enum: ['Consented', 'Opted Out', 'Pending'],
      default: 'Consented',
    },
    consentDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const Parent = mongoose.model('Parent', parentSchema);
export default Parent;
