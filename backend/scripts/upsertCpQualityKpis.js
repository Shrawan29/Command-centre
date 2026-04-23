import dotenv from "dotenv";
import mongoose from "mongoose";
import KPI from "../models/KPI.js";
import Vertical from "../models/Vertical.js";
import User from "../models/User.js";

dotenv.config({ quiet: true });

const QUALITY_KPI_DEFINITIONS = [
  {
    name: "Brand tone in captions",
    target: 100,
    unit: "percentage",
    category: "brand",
    frequency: "monthly",
  },
  {
    name: "Visual consistency with CP brand",
    target: 100,
    unit: "percentage",
    category: "brand",
    frequency: "monthly",
  },
  {
    name: "Logo and brand asset usage",
    target: 100,
    unit: "percentage",
    category: "brand",
    frequency: "monthly",
  },
  {
    name: "Reel content quality",
    target: 100,
    unit: "percentage",
    category: "brand",
    frequency: "monthly",
  },
  {
    name: "Caption - zero errors",
    target: 100,
    unit: "percentage",
    category: "brand",
    frequency: "monthly",
  },
];

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in backend/.env");
  }

  const verticalName = process.env.TOKEN_KPI_VERTICAL_NAME || "CP Hotels & Resorts";

  await mongoose.connect(process.env.MONGO_URI);

  try {
    const vertical = await Vertical.findOne({ name: verticalName }).select("_id name createdBy").lean();
    if (!vertical?._id) {
      throw new Error(`Vertical not found: ${verticalName}`);
    }

    const baselineKpi = await KPI.findOne({ vertical: vertical._id })
      .select("_id assignedTo createdBy")
      .lean();

    if (!baselineKpi?.assignedTo) {
      throw new Error(`No existing KPI assignment found for vertical: ${verticalName}`);
    }

    const admin = await User.findOne({ role: "admin" }).select("_id").lean();
    const createdBy =
      baselineKpi.createdBy ||
      vertical.createdBy ||
      admin?._id ||
      baselineKpi.assignedTo;

    const summary = {
      created: 0,
      updated: 0,
      unchanged: 0,
      items: [],
    };

    for (const definition of QUALITY_KPI_DEFINITIONS) {
      const existing = await KPI.findOne({
        name: definition.name,
        vertical: vertical._id,
        assignedTo: baselineKpi.assignedTo,
      })
        .select("_id target unit category frequency")
        .lean();

      if (!existing) {
        const created = await KPI.create({
          ...definition,
          vertical: vertical._id,
          assignedTo: baselineKpi.assignedTo,
          createdBy,
        });

        summary.created += 1;
        summary.items.push({
          name: definition.name,
          action: "created",
          id: String(created._id),
        });
        continue;
      }

      const changed =
        Number(existing.target) !== Number(definition.target) ||
        String(existing.unit || "") !== String(definition.unit || "") ||
        String(existing.category || "") !== String(definition.category || "") ||
        String(existing.frequency || "") !== String(definition.frequency || "");

      if (!changed) {
        summary.unchanged += 1;
        summary.items.push({
          name: definition.name,
          action: "unchanged",
          id: String(existing._id),
        });
        continue;
      }

      await KPI.updateOne(
        { _id: existing._id },
        {
          $set: {
            target: definition.target,
            unit: definition.unit,
            category: definition.category,
            frequency: definition.frequency,
          },
        }
      );

      summary.updated += 1;
      summary.items.push({
        name: definition.name,
        action: "updated",
        id: String(existing._id),
      });
    }

    console.log(
      JSON.stringify(
        {
          vertical: {
            id: String(vertical._id),
            name: vertical.name,
          },
          assignedTo: String(baselineKpi.assignedTo),
          createdBy: String(createdBy),
          summary,
        },
        null,
        2
      )
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(`Quality KPI upsert failed: ${error.message}`);
  process.exit(1);
});
