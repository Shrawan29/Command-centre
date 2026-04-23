import KPI from "../models/KPI.js";
import Submission from "../models/Submission.js";
import { computeKpiMetrics } from "../utils/kpiPerformance.js";
import { getCurrentMonthInstagramTokenMetrics } from "../utils/instagramTokenMetrics.js";
import {
  buildForcedMetricOptions,
  buildTokenMeta,
  getForcedTokenTotal,
  hasTokenMappedKpi,
} from "../utils/tokenKpiMapping.js";

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

// @desc   Create KPI
export const createKPI = async (req, res) => {
  try {
    const { name, target, unit, category, frequency, vertical, assignedTo } = req.body;

    const kpi = await KPI.create({
      name,
      target,
      unit,
      category,
      frequency,
      vertical,
      assignedTo,
      createdBy: req.body.createdBy || null,
    });

    res.status(201).json({
      message: "KPI created successfully",
      kpi,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error creating KPI",
      error: error.message,
    });
  }
};

// @desc   Get all KPIs (Admin)
export const getKPIs = async (req, res) => {
  try {
    const kpis = await KPI.find()
      .populate("vertical", "name")
      .populate(
        "assignedTo",
        "name email companyName agencyType contractValue engagementStart engagementEnd primaryContact profileScore"
      )
      .populate("createdBy", "name email companyName agencyType primaryContact");

    const tokenPayload = hasTokenMappedKpi(kpis)
      ? await getCurrentMonthInstagramTokenMetrics()
      : null;

    const kpiIds = kpis.map((kpi) => kpi._id);
    const submissions = kpiIds.length
      ? await Submission.find({ kpi: { $in: kpiIds } })
      : [];
    const submissionsByKpi = groupSubmissionsByKpi(submissions);

    const kpisWithMetrics = await Promise.all(
      kpis.map(async (kpi) => {
        const forced = getForcedTokenTotal(kpi, tokenPayload);

        const metrics = computeKpiMetrics(
          kpi,
          submissionsByKpi.get(String(kpi._id)) || [],
          new Date(),
          buildForcedMetricOptions(forced)
        );

        return {
          ...kpi.toObject(),
          total: metrics.total,
          performance: Number(metrics.performance.toFixed(2)),
          completion: Number(metrics.completion.toFixed(2)),
          status: metrics.status,
          meta: {
            ...metrics.meta,
            tokenMetrics: buildTokenMeta(forced, tokenPayload),
          },
        };
      })
    );

    res.status(200).json(kpisWithMetrics);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching KPIs",
      error: error.message,
    });
  }
};

// @desc   Get KPIs for specific agency
export const getMyKPIs = async (req, res) => {
  try {
    const userId = req.user._id;

    const kpis = await KPI.find({ assignedTo: userId });
    const tokenPayload = hasTokenMappedKpi(kpis)
      ? await getCurrentMonthInstagramTokenMetrics()
      : null;

    const kpiIds = kpis.map((kpi) => kpi._id);
    const submissions = kpiIds.length
      ? await Submission.find({ kpi: { $in: kpiIds } })
      : [];
    const submissionsByKpi = groupSubmissionsByKpi(submissions);

    const kpisWithMetrics = await Promise.all(
      kpis.map(async (kpi) => {
        const forced = getForcedTokenTotal(kpi, tokenPayload);

        const metrics = computeKpiMetrics(
          kpi,
          submissionsByKpi.get(String(kpi._id)) || [],
          new Date(),
          buildForcedMetricOptions(forced)
        );

        return {
          ...kpi.toObject(),
          total: metrics.total,
          performance: Number(metrics.performance.toFixed(2)),
          completion: Number(metrics.completion.toFixed(2)),
          status: metrics.status,
          meta: {
            ...metrics.meta,
            tokenMetrics: buildTokenMeta(forced, tokenPayload),
          },
        };
      })
    );

    res.status(200).json(kpisWithMetrics);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching user KPIs",
      error: error.message,
    });
  }
};

// @desc   Update KPI
export const updateKPI = async (req, res) => {
  try {
    const { id } = req.params;

    const kpi = await KPI.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!kpi) {
      return res.status(404).json({ message: "KPI not found" });
    }

    res.status(200).json(kpi);
  } catch (error) {
    res.status(500).json({
      message: "Error updating KPI",
      error: error.message,
    });
  }
};

// @desc   Delete KPI
export const deleteKPI = async (req, res) => {
  try {
    const { id } = req.params;

    await KPI.findByIdAndDelete(id);

    res.status(200).json({
      message: "KPI deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Error deleting KPI",
      error: error.message,
    });
  }
};