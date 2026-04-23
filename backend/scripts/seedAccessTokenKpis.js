import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/User.js";
import Vertical from "../models/Vertical.js";
import KPI from "../models/KPI.js";
import Submission from "../models/Submission.js";

dotenv.config();

const GRAPH_VERSION = process.env.FACEBOOK_GRAPH_VERSION || "v23.0";
const ACCESS_TOKEN = String(process.env.FACEBOOK_ACCESS_TOKEN || "").trim();
const ENV_IG_ACCOUNT_ID = String(process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || "").trim();
const DRY_RUN = process.argv.includes("--dry-run");
const RESET = process.argv.includes("--reset");
const CP_ONLY = process.argv.includes("--cp-only");
const DEFAULT_VERTICAL_NAME = "Instagram Access Token KPIs";
const CP_VERTICAL_NAME = process.env.TOKEN_KPI_VERTICAL_NAME || "CP Hotels & Resorts";
const CP_VENDOR_NAME = process.env.TOKEN_KPI_VENDOR_NAME || "BeyondBrief (Rachit)";
const CP_VENDOR_EMAIL = String(
  process.env.TOKEN_KPI_VENDOR_EMAIL || "beyondbrief.rachit@commandcentre.local"
)
  .trim()
  .toLowerCase();

const KPI_TEMPLATE_BY_SIGNAL = {
  mediaPublished: {
    name: "Total Media Published",
    target: 60,
    unit: "count",
    category: "deliverables",
    frequency: "monthly",
  },
  reelsPublished: {
    name: "Reels Published",
    target: 20,
    unit: "count",
    category: "deliverables",
    frequency: "monthly",
  },
  storiesPublished: {
    name: "Stories Published",
    target: 40,
    unit: "count",
    category: "deliverables",
    frequency: "monthly",
  },
  imagesPublished: {
    name: "Image Posts Published",
    target: 12,
    unit: "count",
    category: "deliverables",
    frequency: "monthly",
  },
  videosPublished: {
    name: "Video Posts Published",
    target: 8,
    unit: "count",
    category: "deliverables",
    frequency: "monthly",
  },
  carouselsPublished: {
    name: "Carousel Posts Published",
    target: 8,
    unit: "count",
    category: "deliverables",
    frequency: "monthly",
  },
  profileViews: {
    name: "Profile Views",
    target: 2000,
    unit: "count",
    category: "growth",
    frequency: "monthly",
  },
  reach: {
    name: "Reach",
    target: 5000,
    unit: "count",
    category: "growth",
    frequency: "monthly",
  },
  impressions: {
    name: "Impressions",
    target: 8000,
    unit: "count",
    category: "growth",
    frequency: "monthly",
  },
  accountsEngaged: {
    name: "Accounts Engaged",
    target: 500,
    unit: "count",
    category: "growth",
    frequency: "monthly",
  },
  totalInteractions: {
    name: "Total Interactions",
    target: 300,
    unit: "count",
    category: "growth",
    frequency: "monthly",
  },
  websiteClicks: {
    name: "Website Clicks",
    target: 200,
    unit: "count",
    category: "growth",
    frequency: "monthly",
  },
  profileLinkTaps: {
    name: "Profile Link Taps",
    target: 200,
    unit: "count",
    category: "growth",
    frequency: "monthly",
  },
  views: {
    name: "Views",
    target: 3000,
    unit: "count",
    category: "growth",
    frequency: "monthly",
  },
  likes: {
    name: "Likes",
    target: 500,
    unit: "count",
    category: "brand",
    frequency: "monthly",
  },
  comments: {
    name: "Comments",
    target: 80,
    unit: "count",
    category: "brand",
    frequency: "monthly",
  },
  shares: {
    name: "Shares",
    target: 80,
    unit: "count",
    category: "brand",
    frequency: "monthly",
  },
  saves: {
    name: "Saves",
    target: 80,
    unit: "count",
    category: "brand",
    frequency: "monthly",
  },
  replies: {
    name: "Replies",
    target: 40,
    unit: "count",
    category: "brand",
    frequency: "monthly",
  },
  onlineFollowers: {
    name: "Online Followers",
    target: 2000,
    unit: "count",
    category: "growth",
    frequency: "monthly",
  },
  followersCount: {
    name: "Followers Count",
    target: 10000,
    unit: "count",
    category: "growth",
    frequency: "monthly",
  },
  mediaCount: {
    name: "Lifetime Media Count",
    target: 200,
    unit: "count",
    category: "operations",
    frequency: "monthly",
  },
};

function buildGraphUrl(path, params = {}) {
  const normalizedPath = String(path || "").replace(/^\/+/, "");
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${normalizedPath}`);
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }

  search.set("access_token", ACCESS_TOKEN);
  url.search = search.toString();
  return url;
}

async function fetchGraph(path, params = {}) {
  const url = buildGraphUrl(path, params);
  const response = await fetch(url);
  const text = await response.text();

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }

  if (!response.ok || body?.error) {
    const message = body?.error?.message || body?.raw || `Graph API request failed (${response.status})`;
    throw new Error(message);
  }

  return body;
}

async function resolveInstagramAccount() {
  if (ENV_IG_ACCOUNT_ID) {
    const account = await fetchGraph(ENV_IG_ACCOUNT_ID, {
      fields: "id,username,name",
    });

    return {
      id: String(account?.id || ENV_IG_ACCOUNT_ID),
      username: account?.username || null,
      name: account?.name || null,
    };
  }

  const pages = await fetchGraph("me/accounts", {
    fields: "id,name,instagram_business_account{id,username,name},connected_instagram_account{id,username,name}",
    limit: 100,
  });

  const list = Array.isArray(pages?.data) ? pages.data : [];

  for (const page of list) {
    const ig = page?.instagram_business_account || page?.connected_instagram_account;
    if (!ig?.id) continue;

    return {
      id: String(ig.id),
      username: ig?.username || null,
      name: ig?.name || null,
    };
  }

  throw new Error("No connected Instagram business account found for this token");
}

async function discoverSupportedSignals(igAccountId) {
  const signals = new Set([
    "mediaPublished",
    "reelsPublished",
    "storiesPublished",
    "imagesPublished",
    "videosPublished",
    "carouselsPublished",
  ]);
  const warnings = [];

  try {
    const accountFields = await fetchGraph(igAccountId, {
      fields: "followers_count,follows_count,media_count",
    });

    if (Number.isFinite(Number(accountFields?.followers_count))) {
      signals.add("followersCount");
    }

    if (Number.isFinite(Number(accountFields?.media_count))) {
      signals.add("mediaCount");
    }
  } catch (error) {
    warnings.push(`Account fields not available: ${error.message}`);
  }

  const insightMetricMap = [
    ["profile_views", "profileViews"],
    ["reach", "reach"],
    ["impressions", "impressions"],
    ["accounts_engaged", "accountsEngaged"],
    ["total_interactions", "totalInteractions"],
    ["website_clicks", "websiteClicks"],
    ["profile_links_taps", "profileLinkTaps"],
    ["views", "views"],
    ["likes", "likes"],
    ["comments", "comments"],
    ["shares", "shares"],
    ["saves", "saves"],
    ["replies", "replies"],
    ["online_followers", "onlineFollowers"],
    ["follower_count", "followersCount"],
  ];

  async function tryInsightMetric(metricName, metricType) {
    const payload = await fetchGraph(`${igAccountId}/insights`, {
      metric: metricName,
      period: "day",
      metric_type: metricType,
    });

    return Array.isArray(payload?.data) ? payload.data : [];
  }

  for (const [metricName, signalName] of insightMetricMap) {
    try {
      let data;

      try {
        data = await tryInsightMetric(metricName, undefined);
      } catch (error) {
        const shouldRetryWithTotalValue = String(error?.message || "")
          .toLowerCase()
          .includes("metric_type=total_value");

        if (!shouldRetryWithTotalValue) throw error;

        data = await tryInsightMetric(metricName, "total_value");
      }

      if (Array.isArray(data) && data.length > 0) {
        signals.add(signalName);
      }
    } catch (error) {
      warnings.push(`${metricName} not available: ${error.message}`);
    }
  }

  return {
    signals: Array.from(signals),
    warnings,
  };
}

async function upsertKpi(verticalId, userId, template) {
  const existing = await KPI.findOne({
    name: template.name,
    vertical: verticalId,
    assignedTo: userId,
  });

  if (!existing) {
    if (!DRY_RUN) {
      await KPI.create({
        ...template,
        vertical: verticalId,
        assignedTo: userId,
        createdBy: userId,
      });
    }

    return "created";
  }

  const changed =
    Number(existing.target) !== Number(template.target) ||
    String(existing.unit || "") !== String(template.unit || "") ||
    String(existing.category || "") !== String(template.category || "") ||
    String(existing.frequency || "") !== String(template.frequency || "");

  if (changed && !DRY_RUN) {
    existing.target = template.target;
    existing.unit = template.unit;
    existing.category = template.category;
    existing.frequency = template.frequency;
    await existing.save();
  }

  return changed ? "updated" : "unchanged";
}

async function main() {
  if (!ACCESS_TOKEN) {
    throw new Error("FACEBOOK_ACCESS_TOKEN is empty in backend/.env");
  }

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in backend/.env");
  }

  const account = await resolveInstagramAccount();
  const discovery = await discoverSupportedSignals(account.id);
  const templates = discovery.signals
    .map((signal) => KPI_TEMPLATE_BY_SIGNAL[signal])
    .filter(Boolean);

  if (!templates.length) {
    throw new Error("No KPI templates matched supported token signals");
  }

  await mongoose.connect(process.env.MONGO_URI);

  try {
    const adminUsers = await User.find({ role: "admin" }).select("_id name email role").lean();
    const firstAdmin = adminUsers[0] || null;

    let assignees = [];
    let resetSummary = null;
    const verticalName = CP_ONLY ? CP_VERTICAL_NAME : DEFAULT_VERTICAL_NAME;

    if (CP_ONLY) {
      if (RESET && !DRY_RUN) {
        const deletedSubmissions = await Submission.deleteMany({});
        const deletedKpis = await KPI.deleteMany({});
        const deletedVerticals = await Vertical.deleteMany({});
        const deletedAgencies = await User.deleteMany({ role: "agency" });

        resetSummary = {
          deletedSubmissions: deletedSubmissions.deletedCount || 0,
          deletedKpis: deletedKpis.deletedCount || 0,
          deletedVerticals: deletedVerticals.deletedCount || 0,
          deletedAgencyUsers: deletedAgencies.deletedCount || 0,
        };
      } else if (RESET && DRY_RUN) {
        resetSummary = {
          dryRun: true,
          note: "Reset requested, but no records were deleted in dry-run mode",
        };
      }

      let cpVendor = await User.findOne({
        role: "agency",
        email: CP_VENDOR_EMAIL,
      })
        .select("_id name email role")
        .lean();

      if (!cpVendor) {
        if (DRY_RUN) {
          cpVendor = {
            _id: "dry-run-vendor",
            name: CP_VENDOR_NAME,
            email: CP_VENDOR_EMAIL,
            role: "agency",
          };
        } else {
          const createdVendor = await User.create({
            name: CP_VENDOR_NAME,
            email: CP_VENDOR_EMAIL,
            role: "agency",
            companyName: "Centre Point Hospitality",
          });

          cpVendor = {
            _id: createdVendor._id,
            name: createdVendor.name,
            email: createdVendor.email,
            role: createdVendor.role,
          };
        }
      } else if (!DRY_RUN && cpVendor.name !== CP_VENDOR_NAME) {
        const updatedVendor = await User.findByIdAndUpdate(
          cpVendor._id,
          {
            name: CP_VENDOR_NAME,
            companyName: "Centre Point Hospitality",
          },
          { new: true }
        )
          .select("_id name email role")
          .lean();

        cpVendor = updatedVendor || cpVendor;
      }

      assignees = cpVendor ? [cpVendor] : [];
    } else {
      const agencyUsers = await User.find({ role: "agency" }).select("_id name email role").lean();
      assignees = agencyUsers.length ? agencyUsers : adminUsers;
    }

    if (!assignees.length) {
      throw new Error("No users found to assign KPIs");
    }

    let vertical = await Vertical.findOne({ name: verticalName });

    if (!vertical) {
      if (!DRY_RUN) {
        vertical = await Vertical.create({
          name: verticalName,
          description: "Auto-generated KPIs based on token-supported Instagram metrics",
          createdBy: firstAdmin?._id || assignees[0]._id,
        });
      } else {
        vertical = {
          _id: "dry-run-vertical",
          name: verticalName,
        };
      }
    }

    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const user of assignees) {
      for (const template of templates) {
        const result = await upsertKpi(vertical._id, user._id, template);
        if (result === "created") created += 1;
        else if (result === "updated") updated += 1;
        else unchanged += 1;
      }
    }

    console.log(JSON.stringify({
      mode: DRY_RUN ? "dry-run" : "write",
      scope: {
        cpOnly: CP_ONLY,
        reset: RESET,
      },
      graphVersion: GRAPH_VERSION,
      instagramAccount: account,
      assigneeCount: assignees.length,
      assignees: assignees.map((u) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role })),
      vertical: {
        id: String(vertical._id),
        name: vertical.name,
      },
      resetSummary,
      supportedSignals: discovery.signals,
      warnings: discovery.warnings,
      kpisConsidered: templates.map((t) => t.name),
      result: { created, updated, unchanged },
    }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(`Token KPI seeding failed: ${error.message}`);
  process.exit(1);
});
