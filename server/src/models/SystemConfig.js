import mongoose from 'mongoose';

const systemConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'risk_policy',
    },
    attendanceThreshold: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
      default: 75,
    },
    marksThreshold: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
      default: 50,
    },
    missingAssignmentsThreshold: {
      type: Number,
      required: true,
      min: 1,
      max: 20,
      default: 2,
    },
    excessiveLeaveThreshold: {
      type: Number,
      required: true,
      min: 1,
      max: 60,
      default: 6,
    },
    description: {
      type: String,
      default: 'Configurable academic risk threshold criteria',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Helper static method to get active risk thresholds
systemConfigSchema.statics.getRiskThresholds = async function () {
  let config = await this.findOne({ key: 'risk_policy' });
  if (!config) {
    config = await this.create({
      key: 'risk_policy',
      attendanceThreshold: 75,
      marksThreshold: 50,
      missingAssignmentsThreshold: 2,
      excessiveLeaveThreshold: 6,
    });
  } else {
    // Ensure default fields exist if older doc exists
    let modified = false;
    if (config.missingAssignmentsThreshold === undefined) {
      config.missingAssignmentsThreshold = 2;
      modified = true;
    }
    if (config.excessiveLeaveThreshold === undefined) {
      config.excessiveLeaveThreshold = 6;
      modified = true;
    }
    if (modified) await config.save();
  }
  return config;
};

const SystemConfig = mongoose.model('SystemConfig', systemConfigSchema);
export default SystemConfig;
