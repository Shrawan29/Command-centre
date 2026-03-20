import KPI from "../models/KPI.js";
import Submission from "../models/Submission.js";
import { computeKpiMetrics } from "../utils/kpiPerformance.js";

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

    let totalKPIs = kpis.length;
    let onTrack = 0;
    let atRisk = 0;
    let behind = 0;
    let completed = 0;

    let totalPerformance = 0;

    for (let kpi of kpis) {
      const submissions = await Submission.find({ kpi: kpi._id });

      const metrics = computeKpiMetrics(kpi, submissions);
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