import mongoose from "mongoose";

const mediaQualityScoreSchema = new mongoose.Schema(
  {
    mediaId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    accountId: {
      type: String,
      required: true,
      index: true,
    },
    mediaType: {
      type: String,
      default: "",
    },
    mediaProductType: {
      type: String,
      default: "",
    },
    timestamp: {
      type: Date,
      default: null,
    },
    permalink: {
      type: String,
      default: "",
    },
    captionFingerprint: {
      type: String,
      default: "",
      index: true,
    },
    evaluator: {
      type: String,
      enum: ["openai", "heuristic"],
      default: "heuristic",
    },
    model: {
      type: String,
      default: "",
    },
    scores: {
      brandToneInCaptions: { type: Number, default: 0 },
      visualConsistencyWithCpBrand: { type: Number, default: 0 },
      logoAndBrandAssetUsage: { type: Number, default: 0 },
      reelContentQuality: { type: Number, default: 0 },
      captionZeroErrors: { type: Number, default: 0 },
    },
    notes: {
      type: String,
      default: "",
    },
    reviewedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

mediaQualityScoreSchema.index({ accountId: 1, reviewedAt: -1 });

const MediaQualityScore = mongoose.model("MediaQualityScore", mediaQualityScoreSchema);

export default MediaQualityScore;
