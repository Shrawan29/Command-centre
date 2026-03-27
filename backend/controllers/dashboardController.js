import KPI from "../models/KPI.js";
import Submission from "../models/Submission.js";
import { computeKpiMetrics } from "../utils/kpiPerformance.js";

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function groupSubmissionsByKpi(submissions = []) {
  const map = new Map();
  for (const submission of submissions) {
    const key = String(submission?.kpi || "");
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(submission);
  }
  return map;
}

// @desc   Get Vertical Dashboard
export const getVerticalDashboard = async (req, res) => {
  try {
    const { verticalId } = req.params;

    // Get KPIs of this vertical
    const kpiFilter = { vertical: verticalId };
    if (req.user?.role === "agency") {
      kpiFilter.assignedTo = req.user._id;
    }
    const kpis = await KPI.find(kpiFilter);

    const kpiIds = kpis.map((kpi) => kpi._id);
    const submissions = kpiIds.length
      ? await Submission.find({ kpi: { $in: kpiIds } })
      : [];
    const submissionsByKpi = groupSubmissionsByKpi(submissions);

    let totalKPIs = kpis.length;
    let onTrack = 0;
    let atRisk = 0;
    let behind = 0;
    let completed = 0;

    let totalPerformance = 0;

    for (let kpi of kpis) {
      const metrics = computeKpiMetrics(kpi, submissionsByKpi.get(String(kpi._id)) || []);
      const performance = metrics.performance;

      totalPerformance += performance;

      if (metrics.status === "Completed") {
        completed++;
      } else if (metrics.status === "On Track") {
        onTrack++;
      } else if (metrics.status === "At Risk") {
        atRisk++;
      } else {
        behind++;
      }
    }

    // 🔥 Health Score (average performance)
    const healthScore =
      totalKPIs > 0 ? (totalPerformance / totalKPIs).toFixed(0) : 0;

    res.status(200).json({
      totalKPIs,
      onTrack,
      atRisk,
      behind,
      completed,
      healthScore,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching dashboard",
      error: error.message,
    });
  }
};

// @desc   Get Dashboard Overview (all verticals and attention rows in one call)
export const getDashboardOverview = async (req, res) => {
  try {
    const kpiFilter = {};
    if (req.user?.role === "agency") {
      kpiFilter.assignedTo = req.user._id;
    }

    const kpis = await KPI.find(kpiFilter).populate("vertical", "name");
    const kpiIds = kpis.map((kpi) => kpi._id);

    const submissions = kpiIds.length
      ? await Submission.find({ kpi: { $in: kpiIds } })
      : [];
    const submissionsByKpi = groupSubmissionsByKpi(submissions);

    const dashboardsByVertical = {};
    const attentionRows = [];

    for (const kpi of kpis) {
      const kpiSubmissions = submissionsByKpi.get(String(kpi._id)) || [];
      const metrics = computeKpiMetrics(kpi, kpiSubmissions);

      const verticalId = String(kpi?.vertical?._id || kpi?.vertical || "");
      if (!verticalId) continue;

      if (!dashboardsByVertical[verticalId]) {
        dashboardsByVertical[verticalId] = {
          totalKPIs: 0,
          onTrack: 0,
          atRisk: 0,
          behind: 0,
          completed: 0,
          healthScore: 0,
          _healthSum: 0,
        };
      }

      const bucket = dashboardsByVertical[verticalId];
      bucket.totalKPIs += 1;
      bucket._healthSum += toNumber(metrics.performance, 0);

      if (metrics.status === "Completed") bucket.completed += 1;
      else if (metrics.status === "On Track") bucket.onTrack += 1;
      else if (metrics.status === "At Risk") bucket.atRisk += 1;
      else bucket.behind += 1;

      if (metrics.status === "At Risk" || metrics.status === "Behind") {
        attentionRows.push({
          id: String(kpi._id),
          name: kpi.name,
          verticalName: kpi?.vertical?.name || "Unknown Vertical",
          category: kpi.category || "deliverables",
          unit: kpi.unit || "number",
          frequency: kpi.frequency || "monthly",
          status: metrics.status,
          performance: toNumber(metrics.performance, 0),
          target: toNumber(kpi.target, 0),
          total: toNumber(metrics.total, 0),
        });
      }
    }

    Object.values(dashboardsByVertical).forEach((bucket) => {
      bucket.healthScore = bucket.totalKPIs > 0
        ? Math.round(bucket._healthSum / bucket.totalKPIs)
        : 0;
      delete bucket._healthSum;
    });

    attentionRows.sort((a, b) => a.performance - b.performance);

    return res.status(200).json({
      dashboardsByVertical,
      attentionRows,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching dashboard overview",
      error: error.message,
    });
  }
};