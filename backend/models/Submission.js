import mongoose from "mongoose";

const submissionSchema = new mongoose.Schema(
  {
    kpi: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KPI",
      required: true,
    },

    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    week: {
      type: String, // example: 2026-W1
      required: true,
    },

    value: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Keep submissions queryable by KPI/week/vendor while allowing multiple reports in the same week.
submissionSchema.index({ kpi: 1, week: 1, vendor: 1 });

export default mongoose.model("Submission", submissionSchema);