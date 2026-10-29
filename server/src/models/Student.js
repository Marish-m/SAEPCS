import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true,
      index: true,
    },
    rollNumber: {
      type: String,
      required: [true, 'Roll number is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department reference is required'],
      index: true,
    },
    semester: {
      type: Number,
      required: [true, 'Semester is required'],
      min: 1,
      max: 8,
      default: 1,
      index: true,
    },
    section: {
      type: String,
      default: 'A',
      trim: true,
      uppercase: true,
    },
    admissionYear: {
      type: Number,
      default: 2026,
    },
    parents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Parent',
      },
    ],
    facultyAdvisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      default: null,
    },
    parentContact: {
      name: { type: String, default: '', trim: true },
      relationship: {
        type: String,
        enum: ['Father', 'Mother', 'Guardian', 'Parent', 'Parent / Guardian'],
        default: 'Parent / Guardian',
      },
      phone: { type: String, default: '', trim: true },
      email: { type: String, default: '', trim: true, lowercase: true },
      preferredLanguage: {
        type: String,
        enum: ['en', 'ta', 'hi'],
        default: 'en',
      },
      preferredMethod: {
        type: String,
        enum: ['Automatic', 'SMS', 'Email', 'Voice Call'],
        default: 'Automatic',
      },
      consentStatus: {
        type: String,
        enum: ['Consented', 'Opted Out', 'Pending'],
        default: 'Consented',
      },
      consentDate: { type: Date, default: Date.now },
      notes: { type: String, default: '', trim: true },
      lastNotifiedAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  }
);

studentSchema.index({ department: 1, semester: 1, section: 1 });

const Student = mongoose.model('Student', studentSchema);
export default Student;
