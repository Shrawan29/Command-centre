import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    googleId: {
      type: String,
    },

    passwordHash: {
      type: String,
      select: false,
    },

    role: {
      type: String,
      enum: ["admin", "agency"],
      default: "agency",
    },

    companyName: {
      type: String,
      default: "",
      trim: true,
    },

    agencyType: {
      type: String,
      default: "",
      trim: true,
    },

    contractValue: {
      type: Number,
      default: 0,
      min: 0,
    },

    engagementStart: {
      type: Date,
      default: null,
    },

    engagementEnd: {
      type: Date,
      default: null,
    },

    primaryContact: {
      type: String,
      default: "",
      trim: true,
    },

    profileScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

export default User;