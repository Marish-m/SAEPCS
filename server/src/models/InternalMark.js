import mongoose from 'mongoose';

const internalMarkSchema = new mongoose.Schema(
  {
    assessment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      default: null,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student reference is required'],
      index: true,
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
      min: [1, 'Maximum marks must be greater than zero'],
      default: 50,
    },
    obtainedMarks: {
      type: Number,
      required: [true, 'Obtained marks is required'],
      min: [0, 'Obtained marks cannot be negative'],
      validate: {
        validator: function (val) {
          return val <= this.maxMarks;
        },
        message: 'Obtained marks ({VALUE}) cannot exceed maximum marks',
      },
    },
    percentage: {
      type: Number,
    },
    semester: {
      type: Number,
      default: 1,
    },
    academicYear: {
      type: String,
      default: '2025-2026',
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook: auto-compute percentage
internalMarkSchema.pre('save', function (next) {
  if (this.maxMarks && this.maxMarks > 0) {
    this.percentage = Math.round((this.obtainedMarks / this.maxMarks) * 100 * 10) / 10;
  }
  next();
});

// Compound indexes
internalMarkSchema.index({ student: 1, subject: 1, assessmentType: 1 });
internalMarkSchema.index({ student: 1, semester: 1 });
internalMarkSchema.index({ assessment: 1, student: 1 });

const InternalMark = mongoose.model('InternalMark', internalMarkSchema);
export default InternalMark;
