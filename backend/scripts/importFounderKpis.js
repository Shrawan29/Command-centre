import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/User.js";
import Vertical from "../models/Vertical.js";
import KPI from "../models/KPI.js";
import Submission from "../models/Submission.js";

dotenv.config();

const VENDOR_DATA = [
  {
    vendorName: "Azeem's Agency",
    email: "azeems.agency@commandcentre.local",
    verticalName: "Pablo & Dali Cafes",
    verticalDescription: "Social Media",
    kpis: [
      { name: "Posts published per month", category: "Frequency", benchmark: "8 posts/month" },
      { name: "Reels published per month", category: "Frequency", benchmark: "7 Reels/month" },
      { name: "Story posts per week", category: "Frequency", benchmark: "4+ Stories/week" },
      { name: "Content calendar submitted on time", category: "Frequency", benchmark: "By 25th of prior month" },
      { name: "Brand tone consistency", category: "Quality", benchmark: "100% - zero generic captions" },
      { name: "Visual identity consistency", category: "Quality", benchmark: "No off-brand visuals" },
      { name: "Caption quality (no errors)", category: "Quality", benchmark: "Zero errors" },
      { name: "Food / product photography standard", category: "Quality", benchmark: "Meets brief standard" },
      { name: "Instagram follower growth", category: "Engagement", benchmark: "+3% month-on-month" },
      { name: "Average Reel views", category: "Engagement", benchmark: "5000+ per Reel" },
      { name: "Average Reel plays-to-completion", category: "Engagement", benchmark: ">35%" },
      { name: "Engagement rate (feed posts)", category: "Engagement", benchmark: "3.5%+" },
      { name: "Saves per post (average)", category: "Engagement", benchmark: "10+ saves per post" },
      { name: "Top-performing post this period", category: "Engagement", benchmark: "Reported each period" },
      { name: "Comment response rate", category: "Engagement", benchmark: "100% within 24hrs" },
      { name: "DM response rate", category: "Engagement", benchmark: "100% within 12hrs" },
    ],
  },
  {
    vendorName: "BeyondBrief (Rachit)",
    email: "beyondbrief.rachit@commandcentre.local",
    verticalName: "CP Hotels & Resorts",
    verticalDescription: "Social Media & Content",
    kpis: [
      { name: "Feed posts published per month", category: "Frequency", benchmark: "9 posts/month" },
      { name: "Reels published per month", category: "Frequency", benchmark: "6 Reels/month" },
      { name: "Story posts per week", category: "Frequency", benchmark: "5+ Stories/week" },
      { name: "Festival / seasonal content published on time", category: "Frequency", benchmark: "100% on-date" },
      { name: "Shoot executed this period", category: "Frequency", benchmark: "1 shoot/month min." },
      { name: "Shoot content published within 5 days", category: "Frequency", benchmark: "<=5 days post-shoot" },
      { name: "Brand tone in captions", category: "Quality", benchmark: "100% on-brand" },
      { name: "Visual consistency with CP brand", category: "Quality", benchmark: "Zero off-brand posts" },
      { name: "Logo and brand asset usage", category: "Quality", benchmark: "100% compliant" },
      { name: "Reel content quality", category: "Quality", benchmark: "No substandard reels published" },
      { name: "Caption - zero errors", category: "Quality", benchmark: "Zero errors" },
      { name: "Instagram follower growth", category: "Engagement", benchmark: "+3% month-on-month" },
      { name: "Average Reel views", category: "Engagement", benchmark: "5000+ per Reel" },
      { name: "Average Reel completion rate", category: "Engagement", benchmark: ">30%" },
      { name: "Engagement rate (feed posts)", category: "Engagement", benchmark: "3.5%+" },
      { name: "Reach per post (organic)", category: "Engagement", benchmark: "Improve period-on-period" },
      { name: "Saves per post (average)", category: "Engagement", benchmark: "15+ saves per post" },
      { name: "Top-performing post this period", category: "Engagement", benchmark: "Reported each period" },
      { name: "Comment response rate", category: "Engagement", benchmark: "100% within 24hrs" },
    ],
  },
  {
    vendorName: "IP Events Agency",
    email: "ipevents.agency@commandcentre.local",
    verticalName: "IP Events",
    verticalDescription: "Event Execution",
    kpis: [
      { name: "Events executed this period", category: "Frequency", benchmark: "Per agreed annual plan" },
      { name: "Run-of-show submitted on time", category: "Frequency", benchmark: "100% - 5 days prior" },
      { name: "Concept brief submitted for next event", category: "Frequency", benchmark: "6 weeks lead time" },
      { name: "Pre-event briefing call held", category: "Frequency", benchmark: "100% of events" },
      { name: "Post-event report submitted", category: "Frequency", benchmark: "Within 5 days" },
      { name: "IP development pipeline active", category: "Frequency", benchmark: "1+ concept in pipeline always" },
      { name: "Sponsor / partner asset compliance", category: "Quality", benchmark: "Zero compliance failures" },
      { name: "CP brand standards maintained at venue", category: "Quality", benchmark: "100% compliant" },
      { name: "Event concept approved before execution", category: "Quality", benchmark: "100% - no exceptions" },
      { name: "F&B presentation standard", category: "Quality", benchmark: "Meets brief standard" },
      { name: "Guest experience consistency", category: "Quality", benchmark: "4.0+ guest score" },
      { name: "On-brand social media coverage", category: "Quality", benchmark: "Reviewed post-event" },
      { name: "Total attendance vs target", category: "Engagement", benchmark: "Within 15% of target" },
      { name: "Sales generated per event", category: "Engagement", benchmark: "Meets or exceeds P&L" },
      { name: "Guest feedback score", category: "Engagement", benchmark: "4.0 / 5.0 minimum" },
      { name: "Social media reach generated by event", category: "Engagement", benchmark: "Improve event-on-event" },
      { name: "Event hashtag / tag usage", category: "Engagement", benchmark: "Tracked and reported" },
      { name: "Return attendance rate", category: "Engagement", benchmark: "Track from event 3 onward" },
      { name: "Repeat event viable", category: "Engagement", benchmark: "Reported each event" },
    ],
  },
];

function normalizeSpaces(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function inferFrequency(name, benchmark) {
  const text = `${name} ${benchmark}`.toLowerCase();
  if (text.includes("per week") || text.includes("weekly")) return "weekly";
  if (text.includes("per day") || text.includes("daily")) return "daily";
  if (text.includes("quarter")) return "quarterly";
  if (text.includes("annual") || text.includes("year")) return "yearly";
  if (text.includes("month") || text.includes("monthly")) return "monthly";
  return "monthly";
}

function inferUnit(name, benchmark) {
  const text = `${name} ${benchmark}`.toLowerCase();
  if (text.includes("%") || text.includes("rate") || text.includes("completion")) return "percentage";
  if (text.includes("sales") || text.includes("revenue") || text.includes("p&l") || text.includes("inr")) return "inr";
  if (text.includes("hour") || text.includes("hrs")) return "hours";
  if (text.includes("day") || text.includes("days")) return "days";
  return "count";
}

function inferCategory(sourceCategory, name) {
  const source = normalizeSpaces(sourceCategory).toLowerCase();
  const kpiName = normalizeSpaces(name).toLowerCase();

  if (source === "quality") return "brand";
  if (source === "frequency") return "operations";
  if (source === "engagement") {
    if (kpiName.includes("sales")) return "revenue";
    return "growth";
  }

  return "operations";
}

function inferTarget(name, benchmark) {
  const text = `${name} ${benchmark}`;
  const normalized = normalizeSpaces(text).toLowerCase();
  const numericMatches = normalized.match(/\d+(?:\.\d+)?/g) || [];

  if (numericMatches.length > 0) {
    const first = Number(numericMatches[0]);
    if (Number.isFinite(first) && first > 0) return first;
  }

  if (normalized.includes("zero") || normalized.includes("100%")) return 100;
  if (normalized.includes("reported") || normalized.includes("tracked") || normalized.includes("reviewed")) return 1;
  if (normalized.includes("meets") || normalized.includes("on-brand") || normalized.includes("compliant")) return 1;

  return 1;
}

async function createOrGetVertical(name, description, createdBy) {
  const existing = await Vertical.findOne({ name: normalizeSpaces(name) });
  if (existing) return existing;

  return Vertical.create({
    name: normalizeSpaces(name),
    description: normalizeSpaces(description),
    createdBy,
  });
}

async function createVendorUser(vendorName, email) {
  return User.create({
    name: normalizeSpaces(vendorName),
    email: normalizeSpaces(email).toLowerCase(),
    role: "agency",
    companyName: normalizeSpaces(vendorName),
    primaryContact: "",
  });
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in backend/.env");
  }

  await mongoose.connect(process.env.MONGO_URI);

  try {
    const adminUser = await User.findOne({ role: "admin" }).sort({ createdAt: 1 });
    const createdBy = adminUser?._id || null;

    // Requested: delete vendor from DB
    const deletedVendors = await User.deleteMany({ role: "agency" });

    // Reset KPI/vertical data so import is fully from founder file
    const deletedKpis = await KPI.deleteMany({});
    const deletedSubmissions = await Submission.deleteMany({});
    const deletedVerticals = await Vertical.deleteMany({});

    let createdVendorCount = 0;
    let createdVerticalCount = 0;
    let createdKpiCount = 0;

    for (const vendorBlock of VENDOR_DATA) {
      const vendor = await createVendorUser(vendorBlock.vendorName, vendorBlock.email);
      createdVendorCount += 1;

      const vertical = await createOrGetVertical(vendorBlock.verticalName, vendorBlock.verticalDescription, createdBy || vendor._id);
      if (vertical?.isNew) createdVerticalCount += 1;

      for (const row of vendorBlock.kpis) {
        const name = normalizeSpaces(row.name);
        const benchmark = normalizeSpaces(row.benchmark);

        await KPI.create({
          name,
          target: inferTarget(name, benchmark),
          unit: inferUnit(name, benchmark),
          category: inferCategory(row.category, name),
          frequency: inferFrequency(name, benchmark),
          vertical: vertical._id,
          assignedTo: vendor._id,
          createdBy: createdBy || vendor._id,
        });

        createdKpiCount += 1;
      }
    }

    const verticalCount = await Vertical.countDocuments();
    const vendorCount = await User.countDocuments({ role: "agency" });
    const kpiCount = await KPI.countDocuments();

    console.log(
      JSON.stringify(
        {
          source: "CP_Founder_KPIs (1).docx",
          deleted: {
            vendors: deletedVendors.deletedCount,
            kpis: deletedKpis.deletedCount,
            submissions: deletedSubmissions.deletedCount,
            verticals: deletedVerticals.deletedCount,
          },
          created: {
            vendors: createdVendorCount,
            verticals: verticalCount,
            kpis: createdKpiCount,
          },
          finalCounts: {
            vendors: vendorCount,
            verticals: verticalCount,
            kpis: kpiCount,
          },
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
  console.error(`Founder KPI import failed: ${error.message}`);
  process.exit(1);
});
