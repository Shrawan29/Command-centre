import dotenv from "dotenv";
import mongoose from "mongoose";
import Submission from "../models/Submission.js";

dotenv.config();

function isLegacyUniqueWeekIndex(index) {
  const keys = index?.key || {};
  const hasLegacyKeys = Number(keys.kpi) === 1 && Number(keys.week) === 1 && Object.keys(keys).length === 2;
  return Boolean(index?.unique && hasLegacyKeys);
}

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not set");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const indexes = await Submission.collection.indexes();
  const legacy = indexes.find(isLegacyUniqueWeekIndex);

  if (legacy) {
    await Submission.collection.dropIndex(legacy.name);
    console.log(`Dropped legacy unique index: ${legacy.name}`);
  } else {
    console.log("Legacy unique index not found; nothing to drop.");
  }

  await Submission.syncIndexes();
  console.log("Submission indexes synced with model.");

  const after = await Submission.collection.indexes();
  console.log("Current submission indexes:");
  for (const idx of after) {
    console.log(`- ${idx.name} ${JSON.stringify(idx.key)}${idx.unique ? " (unique)" : ""}`);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch(async (error) => {
  console.error("Migration failed:", error.message);
  try {
    await mongoose.disconnect();
  } catch {
    // no-op
  }
  process.exit(1);
});
