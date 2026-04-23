import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/User.js";
import Vertical from "../models/Vertical.js";
import KPI from "../models/KPI.js";
import Submission from "../models/Submission.js";

dotenv.config();

const CP_VERTICAL_NAME = process.env.TOKEN_KPI_VERTICAL_NAME || "CP Hotels & Resorts";
const CP_VENDOR_NAME = process.env.TOKEN_KPI_VENDOR_NAME || "BeyondBrief (Rachit)";
const CP_VENDOR_EMAIL = String(
  process.env.TOKEN_KPI_VENDOR_EMAIL || "beyondbrief.rachit@commandcentre.local"
)
  .trim()
  .toLowerCase();

const KPI_DEFINITIONS = [
  {
    name: "Feed posts published per month",
    target: 9,
    unit: "count",
    category: "deliverables",
    frequency: "monthly",
  },
  {
    name: "Reels published per month",
    target: 6,
    unit: "count",
    category: "deliverables",
    frequency: "monthly",
  },
  {
    name: "Story posts per week",
    target: 5,
    unit: "count",
    category: "deliverables",
    frequency: "weekly",
  },
  {
    name: "Instagram follower growth",
    target: 3,
    unit: "percentage",
    category: "growth",
    frequency: "monthly",
  },
  {
    name: "Average Reel views",
    target: 5000,
    unit: "count",
    category: "growth",
    frequency: "monthly",
  },
  {
    name: "Average Reel completion rate",
    target: 30,
    unit: "percentage",
    category: "growth",
    frequency: "monthly",
  },
  {
    name: "Engagement rate (feed posts)",
    target: 3.5,
    unit: "percentage",
    category: "brand",
    frequency: "monthly",
  },
  {
    name: "Reach per post (organic)",
    target: 1500,
    unit: "count",
    category: "growth",
    frequency: "monthly",
  },
  {
    name: "Saves per post (average)",
    target: 15,
    unit: "count",
    category: "brand",
    frequency: "monthly",
  },
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

async function ensureCpVendor() {
  let vendor = await User.findOne({ role: "agency", email: CP_VENDOR_EMAIL });

  if (!vendor) {
    vendor = await User.create({
      name: CP_VENDOR_NAME,
      email: CP_VENDOR_EMAIL,
      role: "agency",
      companyName: "Centre Point Hospitality",
    });
  } else if (vendor.name !== CP_VENDOR_NAME || vendor.companyName !== "Centre Point Hospitality") {
    vendor.name = CP_VENDOR_NAME;
    vendor.companyName = "Centre Point Hospitality";
    await vendor.save();
  }

  return vendor;
}

async function ensureCpVertical(createdByUserId) {
  let vertical = await Vertical.findOne({ name: CP_VERTICAL_NAME });

  if (!vertical) {
    vertical = await Vertical.create({
      name: CP_VERTICAL_NAME,
      description: "Centre Point token-based Instagram KPI vertical",
      createdBy: createdByUserId,
    });
  }

  return vertical;
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in backend/.env");
  }

  await mongoose.connect(process.env.MONGO_URI);

  try {
    const admin = await User.findOne({ role: "admin" }).select("_id").lean();
    const vendor = await ensureCpVendor();
    const createdBy = admin?._id || vendor._id;
    const vertical = await ensureCpVertical(createdBy);

    const deletedSubmissions = await Submission.deleteMany({});
    const deletedKpis = await KPI.deleteMany({});
    const deletedOtherVerticals = await Vertical.deleteMany({ _id: { $ne: vertical._id } });

    const docs = KPI_DEFINITIONS.map((kpi) => ({
      ...kpi,
      vertical: vertical._id,
      assignedTo: vendor._id,
      createdBy,
    }));

    const inserted = await KPI.insertMany(docs);

    console.log(
      JSON.stringify(
        {
          vertical: {
            id: String(vertical._id),
            name: vertical.name,
          },
          vendor: {
            id: String(vendor._id),
            name: vendor.name,
            email: vendor.email,
          },
          deleted: {
            submissions: deletedSubmissions.deletedCount || 0,
            kpis: deletedKpis.deletedCount || 0,
            otherVerticals: deletedOtherVerticals.deletedCount || 0,
          },
          createdKpis: inserted.length,
          kpiNames: inserted.map((kpi) => kpi.name),
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
  console.error(`CP KPI seeding failed: ${error.message}`);
  process.exit(1);
});
