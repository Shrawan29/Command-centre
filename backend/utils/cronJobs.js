import cron from "node-cron";
import KPI from "../models/KPI.js";
import Submission from "../models/Submission.js";
import User from "../models/User.js";
import sendEmail from "./sendEmail.js";

// 🕒 Weekly Report (Every Monday 9 AM)
cron.schedule("0 9 * * 1", async () => {
  console.log("Running Weekly KPI Reports...");

  try {
    const kpis = await KPI.find().populate("assignedTo");

    for (let kpi of kpis) {
      const submissions = await Submission.find({ kpi: kpi._id });

      const total = submissions.reduce((sum, s) => sum + s.value, 0);
      const performance = (total / kpi.target) * 100;

      let status = "Behind";
      if (performance >= 100) status = "On Track";
      else if (performance >= 80) status = "At Risk";

      const message = `
Weekly KPI Report

KPI: ${kpi.name}
Target: ${kpi.target}
Achieved: ${total}
Performance: ${performance.toFixed(2)}%
Status: ${status}
`;

      await sendEmail(kpi.assignedTo.email, "Weekly KPI Report", message);
    }

    console.log("Weekly emails sent ✅");
  } catch (error) {
    console.error("Cron error:", error.message);
  }
});