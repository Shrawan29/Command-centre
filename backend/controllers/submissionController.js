import Submission from "../models/Submission.js";
import KPI from "../models/KPI.js";
import { collapseWeeklySubmissions, computeKpiMetrics } from "../utils/kpiPerformance.js";

function normalizeWeek(value = "") {
  const match = String(value).trim().match(/^(\d{4})-W(\d{1,2})$/i);
  if (!match) return null;
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  return `${match[1]}-W${String(week).padStart(2, "0")}`;
}

function getCurrentIsoWeek() {
  const date = new Date();
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// @desc   Admin: list submissions with filters
export const getAdminSubmissions = async (req, res) => {
  try {
    const {
      week,
      vendorId,
      kpiId,
      verticalId,
    } = req.query;

    const normalizedWeek = week ? normalizeWeek(week) : null;
    if (week && !normalizedWeek) {
      return res.status(400).json({ message: "Invalid week format. Use YYYY-Www." });
    }

    const query = {};
    if (normalizedWeek) query.week = normalizedWeek;
    if (vendorId) query.vendor = vendorId;
    if (kpiId) query.kpi = kpiId;

    let submissions = await Submission.find(query)
      .populate("vendor", "name email role")
      .populate({
        path: "kpi",
        select: "name unit frequency vertical",
        populate: {
          path: "vertical",
          select: "name",
        },
      })
      .sort({ updatedAt: -1, createdAt: -1 });

    if (verticalId) {
      submissions = submissions.filter(
        (submission) => String(submission?.kpi?.vertical?._id || "") === String(verticalId)
      );
    }

    return res.status(200).json(
      submissions.map((submission) => ({
        _id: submission._id,
        week: submission.week,
        value: submission.value,
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt,
        vendor: submission.vendor
          ? {
            _id: submission.vendor._id,
            name: submission.vendor.name,
            email: submission.vendor.email,
            role: submission.vendor.role,
          }
          : null,
        kpi: submission.kpi
          ? {
            _id: submission.kpi._id,
            name: submission.kpi.name,
            unit: submission.kpi.unit,
            frequency: submission.kpi.frequency,
            vertical: submission.kpi.vertical
              ? {
                _id: submission.kpi.vertical._id,
                name: submission.kpi.vertical.name,
              }
              : null,
          }
          : null,
      }))
    );
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching submissions",
      error: error.message,
    });
  }
};

// @desc   Submit weekly data
export const submitData = async (req, res) => {
  try {
    const { kpiId, vendorId, week, value } = req.body;
    const normalizedWeek = normalizeWeek(week);

    if (!normalizedWeek) {
      return res.status(400).json({ message: "Invalid week format. Use YYYY-Www." });
    }

    const ongoingWeek = getCurrentIsoWeek();
    if (normalizedWeek !== ongoingWeek) {
      return res.status(400).json({
        message: `Only ongoing week submissions are allowed (${ongoingWeek}).`,
      });
    }

    const existingSubmission = await Submission.findOne({
      kpi: kpiId,
      vendor: vendorId,
      week: normalizedWeek,
    });

    if (existingSubmission) {
      existingSubmission.value = value;
      await existingSubmission.save();

      return res.status(200).json({
        message: "Submission updated successfully",
        submission: existingSubmission,
      });
    }

    const submission = await Submission.create({
      kpi: kpiId,
      vendor: vendorId,
      week: normalizedWeek,
      value,
    });

    return res.status(201).json({
      message: "Submission successful",
      submission,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error submitting data",
      error: error.message,
    });
  }
};

// @desc   Get KPI progress (VERY IMPORTANT)
export const getKPIProgress = async (req, res) => {
  try {
    const { kpiId } = req.params;

    const kpi = await KPI.findById(kpiId);

    // 🔐 Vendor can only access their own KPI
    if (
      req.user.role === "agency" &&
      kpi.assignedTo.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const submissions = await Submission.find({ kpi: kpiId });
    const collapsedSubmissions = collapseWeeklySubmissions(submissions)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

    const metrics = computeKpiMetrics(kpi, collapsedSubmissions);

    res.status(200).json({
      kpi: kpi.name,
      target: kpi.target,
      total: metrics.total,
      performance: metrics.performance.toFixed(2),
      actualProgress: metrics.actualProgress.toFixed(2),
      expectedProgress: metrics.expectedProgress.toFixed(2),
      completion: metrics.completion.toFixed(2),
      status: metrics.status,
      meta: metrics.meta,
      submissions: collapsedSubmissions,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching progress",
      error: error.message,
    });
  }
};
import sendEmail from "../utils/sendEmail.js";
import User from "../models/User.js";

export const sendKPIReport = async (req, res) => {
  try {
    const { kpiId } = req.params;

    const kpi = await KPI.findById(kpiId);
    const user = await User.findById(kpi.assignedTo);

    const submissions = await Submission.find({ kpi: kpiId });

    const metrics = computeKpiMetrics(kpi, submissions);
    const performanceLabel = `Actual: ${metrics.actualProgress.toFixed(2)}%\nExpected: ${metrics.expectedProgress.toFixed(2)}%\nPace: ${metrics.meta?.pace?.toFixed?.(2) ?? Number(metrics.meta?.pace || 0).toFixed(2)}%`;

    const message = `
KPI Report

KPI: ${kpi.name}
Target: ${kpi.target}
Achieved: ${metrics.total}
${performanceLabel}
Status: ${metrics.status}
`;

    await sendEmail(user.email, "KPI Performance Report", message);

    res.status(200).json({ message: "Email sent successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Error sending email",
      error: error.message,
    });
  }
};