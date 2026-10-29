import mongoose from 'mongoose';

const auditEntrySchema = new mongoose.Schema(
  {
    previousStatus: {
      type: String,
      required: true,
    },
    newStatus: {
      type: String,
      required: true,
    },
    previousRemarks: {
      type: String,
      default: '',
    },
    newRemarks: {
      type: String,
      default: '',
    },
    correctedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    correctedByName: {
      type: String,
      default: '',
    },
    reason: {
      type: String,
      required: [true, 'Reason for attendance correction is required for audit trail'],
      trim: true,
    },
    correctedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const attendanceSchema = new mongoose.Schema(
  {
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
    date: {
      type: Date,
      required: [true, 'Attendance date is required'],
      default: Date.now,
      index: true,
    },
    dateStr: {
      type: String,
      required: true,
      index: true,
      // e.g. "2026-10-11" to prevent duplicate entries on the same calendar date
    },
    status: {
      type: String,
      enum: {
        values: ['Present', 'Absent', 'Late', 'Excused', 'On Duty'],
        message: '{VALUE} is not an approved attendance status',
      },
      default: 'Present',
      required: true,
    },
    semester: {
      type: Number,
      default: 1,
    },
    section: {
      type: String,
      default: 'A',
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
    auditTrail: {
      type: [auditEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Pre-validate hook: normalize dateStr to YYYY-MM-DD
attendanceSchema.pre('validate', function (next) {
  if (this.date) {
    const d = new Date(this.date);
    if (!isNaN(d.getTime())) {
      this.dateStr = d.toISOString().split('T')[0];
    }
  }
  next();
});

// Enforce strictly unique attendance entries: same student, same subject, same date
attendanceSchema.index({ student: 1, subject: 1, dateStr: 1 }, { unique: true });
attendanceSchema.index({ faculty: 1, subject: 1, dateStr: 1 });
attendanceSchema.index({ student: 1, date: -1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);
export default Attendance;
