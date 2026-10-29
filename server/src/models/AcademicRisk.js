import mongoose from 'mongoose';

const auditEntrySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        'DETECTED',
        'SEVERITY_CHANGED',
        'RE_EVALUATED',
        'CONDITION_RESOLVED',
        'MANUALLY_RESOLVED',
        'CLOSED',
        'ALERT_SENT',
      ],
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      default: '',
    },
    previousSeverity: {
      type: String,
      default: null,
    },
    newSeverity: {
      type: String,
      default: null,
    },
    previousStatus: {
      type: String,
      default: null,
    },
    newStatus: {
      type: String,
      default: null,
    },
  },
  { _id: true }
);

const academicRiskSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student reference is required'],
      index: true,
    },
    riskType: {
      type: String,
      required: [true, 'Risk type is required'],
      enum: {
        values: [
          'Attendance',
          'Assessment Marks',
          'Missing Assignments',
          'Excessive Leave',
          'Composite',
        ],
        message: '{VALUE} is not a supported risk type',
      },
      index: true,
    },
    severity: {
      type: String,
      required: [true, 'Severity level is required'],
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
      index: true,
    },
    reason: {
      type: String,
      required: [true, 'Exact risk reason is required'],
      trim: true,
    },
    detectedDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Resolved', 'Closed'],
      default: 'Active',
      index: true,
    },
    relatedRecord: {
      model: { type: String, default: null }, // 'Subject', 'Assignment', 'Assessment', 'LeaveRequest'
      id: { type: mongoose.Schema.Types.ObjectId, default: null },
      name: { type: String, default: '' },
      metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    lastEvaluatedDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    resolvedDate: {
      type: Date,
      default: null,
    },
    resolutionReason: {
      type: String,
      default: '',
    },
    auditTrail: {
      type: [auditEntrySchema],
      default: [],
    },

    // Snapshot metrics for quick filtering and backwards compatibility
    attendancePercentage: {
      type: Number,
      default: 100,
    },
    marksAveragePercentage: {
      type: Number,
      default: 100,
    },
    pendingAssignmentsCount: {
      type: Number,
      default: 0,
    },
    missingAssignmentsCount: {
      type: Number,
      default: 0,
    },
    approvedLeaveDays: {
      type: Number,
      default: 0,
    },
    compositeRiskScore: {
      type: Number,
      default: 0,
      index: true,
    },
    riskLevel: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Low Risk', 'Moderate Risk', 'Critical Risk'],
      default: 'Low',
      index: true,
    },
    riskFactors: {
      type: [String],
      default: [],
    },
    recommendedAction: {
      type: String,
      default: '',
    },
    lastAlertSentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// High performance query indices
academicRiskSchema.index({ student: 1, riskType: 1, status: 1 });
academicRiskSchema.index({ status: 1, severity: 1, detectedDate: -1 });
academicRiskSchema.index({ student: 1, status: 1 });
academicRiskSchema.index({ status: 1, compositeRiskScore: -1 });

const AcademicRisk = mongoose.model('AcademicRisk', academicRiskSchema);
export default AcademicRisk;
