import cron from "node-cron";
import KPI from "../models/KPI.js";
import Submission from "../models/Submission.js";
import sendEmail from "./sendEmail.js";
import { collapseWeeklySubmissions, computeKpiMetrics } from "./kpiPerformance.js";

// 🕒 Weekly Report (Every Monday 9 AM)
cron.schedule("0 9 * * 1", async () => {
  console.log("Running Weekly KPI Reports...");

  try {
    const kpis = await KPI.find().populate("assignedTo");

    for (let kpi of kpis) {
      if (!kpi?.assignedTo?.email) continue;

      const submissions = await Submission.find({ kpi: kpi._id });
      const collapsedSubmissions = collapseWeeklySubmissions(submissions);
      const metrics = computeKpiMetrics(kpi, collapsedSubmissions);

      const message = `
Weekly KPI Report

KPI: ${kpi.name}
Target: ${kpi.target}
    Achieved: ${metrics.total}
    Actual: ${metrics.actualProgress.toFixed(2)}%
    Expected: ${metrics.expectedProgress.toFixed(2)}%
    Pace: ${metrics.meta?.pace?.toFixed?.(2) ?? Number(metrics.meta?.pace || 0).toFixed(2)}%
    Status: ${metrics.status}
`;

      await sendEmail(kpi.assignedTo.email, "Weekly KPI Report", message);
    }

    console.log("Weekly emails sent ✅");
  } catch (error) {
    console.error("Cron error:", error.message);
  }
});