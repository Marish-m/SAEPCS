import mongoose from 'mongoose';

const leaveRequestSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student reference is required'],
      index: true,
    },
    appliedBy: {
      type: String,
      enum: ['student', 'parent'],
      required: true,
      default: 'student',
    },
    leaveType: {
      type: String,
      enum: {
        values: ['Medical', 'Academic/Duty', 'Personal', 'Family'],
        message: '{VALUE} is not a valid leave type',
      },
      required: [true, 'Leave type is required'],
      default: 'Personal',
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    reason: {
      type: String,
      required: [true, 'Reason for leave is required'],
      trim: true,
      maxlength: [500, 'Reason cannot exceed 500 characters'],
    },
    documentUrl: {
      type: String,
      default: '',
    },
    documentName: {
      type: String,
      default: '',
    },
    documentSize: {
      type: Number,
      default: 0,
    },
    durationDays: {
      type: Number,
      default: 1,
      min: 1,
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      default: null,
    },
    facultyRemarks: {
      type: String,
      default: '',
      trim: true,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

leaveRequestSchema.pre('save', function (next) {
  if (this.startDate && this.endDate) {
    const diffTime = Math.abs(new Date(this.endDate) - new Date(this.startDate));
    this.durationDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
  }
  next();
});

leaveRequestSchema.index({ student: 1, status: 1 });
leaveRequestSchema.index({ status: 1, createdAt: -1 });

const LeaveRequest = mongoose.model('LeaveRequest', leaveRequestSchema);
export default LeaveRequest;
