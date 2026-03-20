import mongoose from "mongoose";

const KPI_CATEGORIES = ["deliverables", "revenue", "timeline", "brand", "operations", "growth"];
const KPI_UNITS = ["number", "percentage", "leads", "reports", "inr", "hours", "days", "count"];
const KPI_FREQUENCIES = ["daily", "weekly", "monthly", "quarterly", "yearly"];

const kpiSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    target: {
      type: Number,
      required: true,
    },

    unit: {
      type: String,
      enum: KPI_UNITS,
      default: "number",
    },

    category: {
      type: String,
      enum: KPI_CATEGORIES,
      default: "deliverables",
    },

    frequency: {
      type: String,
      enum: KPI_FREQUENCIES,
      default: "monthly",
    },

   vertical: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Vertical",
  required: true,
},

assignedTo: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  required: true,
},

createdBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
},
  },
  {
    timestamps: true,
  }
);

const KPI = mongoose.model("KPI", kpiSchema);

export default KPI;