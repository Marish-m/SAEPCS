import mongoose from 'mongoose';

const assessmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Assessment title is required'],
      trim: true,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject reference is required'],
      index: true,
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      required: [true, 'Faculty reference is required'],
      index: true,
    },
    assessmentType: {
      type: String,
      enum: {
        values: ['Internal 1', 'Internal 2', 'Model Exam', 'Assignment', 'Quiz', 'Final Internal'],
        message: '{VALUE} is not a valid assessment type',
      },
      required: [true, 'Assessment type is required'],
      default: 'Internal 1',
    },
    maxMarks: {
      type: Number,
      required: [true, 'Maximum marks is required'],
      min: [1, 'Maximum marks must be at least 1'],
      default: 50,
    },
    date: {
      type: Date,
      required: [true, 'Assessment date is required'],
      default: Date.now,
    },
    semester: {
      type: Number,
      default: 1,
    },
    academicYear: {
      type: String,
      default: '2025-2026',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

assessmentSchema.index({ subject: 1, assessmentType: 1, semester: 1 });
assessmentSchema.index({ faculty: 1, date: -1 });

const Assessment = mongoose.model('Assessment', assessmentSchema);
export default Assessment;
