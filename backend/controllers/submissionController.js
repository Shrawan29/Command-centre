import Submission from "../models/Submission.js";
import KPI from "../models/KPI.js";
import mongoose from "mongoose";
import { collapseWeeklySubmissions, computeKpiMetrics } from "../utils/kpiPerformance.js";
import { buildKpiPortfolioPdfBuffer, buildKpiPortfolioReportEmail } from "../utils/kpiReportEmail.js";
import { getCurrentMonthInstagramTokenMetrics } from "../utils/instagramTokenMetrics.js";
import {
  buildForcedMetricOptions,
  buildTokenMeta,
  getForcedTokenTotal,
  hasTokenMappedKpi,
} from "../utils/tokenKpiMapping.js";

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

    if (!mongoose.Types.ObjectId.isValid(kpiId)) {
      return res.status(400).json({ message: "Invalid KPI id" });
    }

    const kpi = await KPI.findById(kpiId);
    if (!kpi) {
      return res.status(404).json({ message: "KPI not found" });
    }

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

    const tokenPayload = hasTokenMappedKpi([kpi])
      ? await getCurrentMonthInstagramTokenMetrics()
      : null;
    const forced = getForcedTokenTotal(kpi, tokenPayload);

    const metrics = computeKpiMetrics(
      kpi,
      collapsedSubmissions,
      new Date(),
      buildForcedMetricOptions(forced)
    );

    res.status(200).json({
      kpi: kpi.name,
      target: kpi.target,
      total: metrics.total,
      performance: metrics.performance.toFixed(2),
      actualProgress: metrics.actualProgress.toFixed(2),
      expectedProgress: metrics.expectedProgress.toFixed(2),
      completion: metrics.completion.toFixed(2),
      status: metrics.status,
      meta: {
        ...metrics.meta,
        tokenMetrics: buildTokenMeta(forced, tokenPayload),
      },
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
    const now = new Date();
    const selectedMonth = Number(req.body?.month || (now.getMonth() + 1));
    const selectedYear = Number(req.body?.year || now.getFullYear());
    const selectedVendorId = req.body?.vendorId;

    if (!Number.isInteger(selectedMonth) || selectedMonth < 1 || selectedMonth > 12) {
      return res.status(400).json({ message: "Invalid month. Use 1-12." });
    }

    if (!Number.isInteger(selectedYear) || selectedYear < 2000 || selectedYear > 2100) {
      return res.status(400).json({ message: "Invalid year." });
    }

    if (req.user.role === "admin" && selectedVendorId && !mongoose.Types.ObjectId.isValid(selectedVendorId)) {
      return res.status(400).json({ message: "Invalid vendor id." });
    }

    const reportStart = new Date(Date.UTC(selectedYear, selectedMonth - 1, 1));
    const reportEnd = new Date(Date.UTC(selectedYear, selectedMonth, 0, 23, 59, 59, 999));
    const daysInMonth = new Date(Date.UTC(selectedYear, selectedMonth, 0)).getUTCDate();

    const weekStartDateFromKey = (weekValue = "") => {
      const match = String(weekValue).match(/^(\d{4})-W(\d{2})$/);
      if (!match) return null;

      const y = Number(match[1]);
      const w = Number(match[2]);
      const jan4 = new Date(Date.UTC(y, 0, 4));
      const jan4Day = jan4.getUTCDay() || 7;
      const week1Monday = new Date(jan4);
      week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));

      const weekStart = new Date(week1Monday);
      weekStart.setUTCDate(week1Monday.getUTCDate() + ((w - 1) * 7));
      return weekStart;
    };

    const isoWeekString = (date) => {
      const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      const day = utc.getUTCDay() || 7;
      utc.setUTCDate(utc.getUTCDate() + 4 - day);
      const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
      const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
      return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
    };

    const weekCountInMonth = () => {
      const weekKeys = new Set();
      const cursor = new Date(reportStart);
      while (cursor <= reportEnd) {
        weekKeys.add(isoWeekString(cursor));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      return Array.from(weekKeys).filter((weekKey) => {
        const weekStart = weekStartDateFromKey(weekKey);
        if (!weekStart) return false;
        return weekStart >= reportStart && weekStart <= reportEnd;
      }).length;
    };

    const isWeekInMonth = (weekValue = "") => {
      const start = weekStartDateFromKey(weekValue);
      if (!start) return false;
      return start >= reportStart && start <= reportEnd;
    };

    const isSubmissionInMonth = (submission) => {
      const week = String(submission?.week || "").trim();
      if (week) return isWeekInMonth(week);

      const ts = new Date(submission?.updatedAt || submission?.createdAt || 0);
      if (Number.isNaN(ts.getTime())) return false;
      return ts >= reportStart && ts <= reportEnd;
    };

    const expectedForMonth = (kpi) => {
      const target = Number(kpi?.target || 0);
      const frequency = String(kpi?.frequency || "monthly").toLowerCase();

      if (target <= 0) return 0;

      if (frequency === "daily") {
        return target * daysInMonth;
      }

      if (frequency === "weekly") {
        const count = weekCountInMonth();
        return target * Math.max(1, count);
      }

      if (frequency === "quarterly") {
        return target / 3;
      }

      if (frequency === "yearly") {
        return target / 12;
      }

      // monthly/default
      return target;
    };

    const isAllReport = String(kpiId).toLowerCase() === "all";
    if (!isAllReport && !mongoose.Types.ObjectId.isValid(kpiId)) {
      return res.status(400).json({ message: "Invalid KPI id" });
    }

    const kpiQuery = {};
    if (isAllReport) {
      if (req.user.role === "agency") {
        kpiQuery.assignedTo = req.user._id;
      } else if (selectedVendorId) {
        kpiQuery.assignedTo = selectedVendorId;
      }
    } else {
      kpiQuery._id = kpiId;
    }

    const kpis = await KPI.find(kpiQuery)
      .populate("vertical", "name")
      .populate("assignedTo", "name email role");

    if (!Array.isArray(kpis) || kpis.length === 0) {
      return res.status(404).json({ message: "No KPIs found for report" });
    }

    if (req.user.role === "agency") {
      const blocked = kpis.some((item) => String(item?.assignedTo?._id || item?.assignedTo) !== String(req.user._id));
      if (blocked) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    const assignedUserIds = Array.from(
      new Set(
        kpis
          .map((item) => String(item?.assignedTo?._id || item?.assignedTo || ""))
          .filter(Boolean)
      )
    );

    const assignedUsers = await User.find({ _id: { $in: assignedUserIds } }).select("name email role");
    if (!assignedUsers.length) {
      return res.status(400).json({ message: "Assigned vendor email is missing" });
    }

    const adminUsers = await User.find({ role: "admin" }).select("name email role");

    const recipients = [
      ...assignedUsers
        .filter((user) => user?.email)
        .map((user) => ({
          role: user.role,
          name: user.name,
          email: user.email,
        })),
      ...adminUsers
        .filter((user) => user?.email)
        .map((user) => ({
          role: user.role,
          name: user.name,
          email: user.email,
        })),
    ].filter((recipient, index, list) => {
      const email = String(recipient?.email || "").trim().toLowerCase();
      if (!email) return false;
      return list.findIndex((item) => String(item?.email || "").trim().toLowerCase() === email) === index;
    });

    if (recipients.length === 0) {
      return res.status(400).json({ message: "No valid email recipients found for this report" });
    }

    const submissions = await Submission.find({
      kpi: { $in: kpis.map((item) => item._id) },
    });

    const submissionsByKpi = new Map();
    submissions.forEach((submission) => {
      const key = String(submission?.kpi || "");
      if (!submissionsByKpi.has(key)) submissionsByKpi.set(key, []);
      submissionsByKpi.get(key).push(submission);
    });

    const rows = kpis
      .map((kpi) => {
        const kpiSubmissions = collapseWeeklySubmissions(submissionsByKpi.get(String(kpi._id)) || []);
        const monthSubmissions = kpiSubmissions.filter((submission) => isSubmissionInMonth(submission));
        const actual = monthSubmissions.reduce((sum, item) => sum + Number(item?.value || 0), 0);
        const expected = expectedForMonth(kpi);
        const progress = expected > 0 ? (actual / expected) * 100 : 0;
        const status = progress >= 100 ? "Completed" : progress >= 80 ? "On Track" : progress >= 60 ? "At Risk" : "Behind";

        return {
          kpiId: String(kpi._id),
          kpiName: kpi.name,
          verticalName: kpi?.vertical?.name || "Unassigned Vertical",
          frequency: kpi.frequency,
          unit: kpi.unit,
          expected,
          actual,
          progress,
          status,
          submissionCount: monthSubmissions.length,
          assignedTo: kpi?.assignedTo?.name || kpi?.assignedTo?.email || "-",
        };
      })
      .sort((a, b) => {
        if (a.verticalName === b.verticalName) return a.kpiName.localeCompare(b.kpiName);
        return a.verticalName.localeCompare(b.verticalName);
      });

    if (!rows.length) {
      return res.status(404).json({ message: "No KPI rows available for report" });
    }

    const generatedAt = new Date();
    const requestedBy = req.user?.name || req.user?.email || "System";
    const assignedTo = assignedUsers.length === 1
      ? (assignedUsers[0]?.name || assignedUsers[0]?.email || "-")
      : `${assignedUsers.length} Agencies`;

    const reportEmail = buildKpiPortfolioReportEmail({
      rows,
      generatedAt,
      requestedBy,
      assignedTo,
      month: selectedMonth,
      year: selectedYear,
    });

    const pdfBuffer = await buildKpiPortfolioPdfBuffer({
      rows,
      generatedAt,
      requestedBy,
      assignedTo,
      month: selectedMonth,
      year: selectedYear,
      summary: reportEmail.summary,
    });

    const attachments = [
      {
        filename: reportEmail.fileName,
        content: pdfBuffer.toString("base64"),
      },
    ];

    await Promise.all(
      recipients.map((recipient) =>
        sendEmail(recipient.email, reportEmail.subject, reportEmail.text, {
          html: reportEmail.html,
          attachments,
        })
      )
    );

    res.status(200).json({
      message: `Report sent successfully to ${recipients.length} recipient(s)`,
      month: selectedMonth,
      year: selectedYear,
      rows: rows.length,
      recipients: recipients.map((recipient) => ({
        role: recipient.role,
        name: recipient.name,
        email: recipient.email,
      })),
    });
  } catch (error) {
    console.error("sendKPIReport error:", error);

    if (error.code === "EMAIL_CONFIG") {
      return res.status(503).json({
        message: "Email service is misconfigured. Verify RESEND_APIKEY and RESEND_FROM (verified sender/domain).",
      });
    }

    if (["EMAIL_DELIVERY_FAILED", "ECONNECTION", "ETIMEDOUT", "ESOCKET"].includes(error.code)) {
      return res.status(502).json({
        message: "Unable to deliver email right now. Please try again shortly.",
      });
    }

    res.status(500).json({
      message: error.message || "Error sending email",
      error: error.message,
    });
  }
};