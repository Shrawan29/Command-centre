import PDFDocument from "pdfkit";

function fmtDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function statusColor(status = "") {
  if (status === "On Track") return "#047857";
  if (status === "At Risk") return "#b45309";
  if (status === "Completed") return "#0c4a6e";
  return "#b91c1c";
}

function safeFilePart(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "kpi";
}

export function buildKpiReportEmail({
  kpi,
  metrics,
  submissions,
  generatedAt,
  requestedBy,
  assignedTo,
}) {
  const rows = (Array.isArray(submissions) ? submissions : [])
    .map((submission) => ({
      week: submission?.week || "-",
      value: Number(submission?.value || 0).toFixed(2),
      updatedAt: fmtDate(submission?.updatedAt || submission?.createdAt),
    }))
    .sort((a, b) => String(b.week).localeCompare(String(a.week)));

  const generatedAtLabel = fmtDate(generatedAt || new Date());
  const status = metrics?.status || "Behind";
  const statusHex = statusColor(status);
  const performance = Number(metrics?.performance || 0).toFixed(2);
  const actual = Number(metrics?.actualProgress || 0).toFixed(2);
  const expected = Number(metrics?.expectedProgress || 0).toFixed(2);
  const pace = Number(metrics?.meta?.pace || 0).toFixed(2);

  const text = [
    "KPI Performance Report",
    "",
    `Generated: ${generatedAtLabel}`,
    `Requested By: ${requestedBy || "System"}`,
    `Assigned To: ${assignedTo || "-"}`,
    "",
    `KPI: ${kpi?.name || "-"}`,
    `Target: ${Number(kpi?.target || 0).toFixed(2)}`,
    `Achieved: ${Number(metrics?.total || 0).toFixed(2)}`,
    `Status: ${status}`,
    `Performance: ${performance}%`,
    `Actual Progress: ${actual}%`,
    `Expected Progress: ${expected}%`,
    `Pace: ${pace}%`,
    "",
    "Submission Details:",
    ...rows.map((row, index) => `${index + 1}. ${row.week} | ${row.value} | ${row.updatedAt}`),
  ].join("\n");

  const htmlRows = rows.length
    ? rows.map((row) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(row.week)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${escapeHtml(row.value)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(row.updatedAt)}</td>
        </tr>
      `).join("")
    : "<tr><td colspan=\"3\" style=\"padding:14px 12px;color:#64748b;\">No submissions available yet.</td></tr>";

  const html = `
<div style="background:#f8fafc;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <div style="padding:20px 24px;background:linear-gradient(135deg,#0f172a,#1e293b);color:#ffffff;">
      <p style="margin:0;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.8;">Command Centre</p>
      <h1 style="margin:8px 0 0;font-size:20px;line-height:1.2;">KPI Performance Report</h1>
      <p style="margin:6px 0 0;font-size:13px;opacity:0.85;">Generated on ${escapeHtml(generatedAtLabel)}</p>
    </div>

    <div style="padding:20px 24px;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
        <span style="display:inline-block;padding:6px 10px;border-radius:999px;background:#f1f5f9;font-size:12px;">Requested By: ${escapeHtml(requestedBy || "System")}</span>
        <span style="display:inline-block;padding:6px 10px;border-radius:999px;background:#f1f5f9;font-size:12px;">Assigned To: ${escapeHtml(assignedTo || "-")}</span>
        <span style="display:inline-block;padding:6px 10px;border-radius:999px;background:#ecfeff;font-size:12px;">KPI: ${escapeHtml(kpi?.name || "-")}</span>
      </div>

      <table style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:18px;">
        <tbody>
          <tr>
            <td style="padding:12px;border-bottom:1px solid #e2e8f0;color:#475569;">Target</td>
            <td style="padding:12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">${escapeHtml(Number(kpi?.target || 0).toFixed(2))}</td>
          </tr>
          <tr>
            <td style="padding:12px;border-bottom:1px solid #e2e8f0;color:#475569;">Achieved</td>
            <td style="padding:12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">${escapeHtml(Number(metrics?.total || 0).toFixed(2))}</td>
          </tr>
          <tr>
            <td style="padding:12px;border-bottom:1px solid #e2e8f0;color:#475569;">Performance</td>
            <td style="padding:12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">${escapeHtml(performance)}%</td>
          </tr>
          <tr>
            <td style="padding:12px;border-bottom:1px solid #e2e8f0;color:#475569;">Actual / Expected</td>
            <td style="padding:12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">${escapeHtml(actual)}% / ${escapeHtml(expected)}%</td>
          </tr>
          <tr>
            <td style="padding:12px;color:#475569;">Status</td>
            <td style="padding:12px;text-align:right;font-weight:700;color:${statusHex};">${escapeHtml(status)}</td>
          </tr>
        </tbody>
      </table>

      <h2 style="margin:0 0 8px;font-size:15px;">Submission Details</h2>
      <table style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
        <thead style="background:#f8fafc;">
          <tr>
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#475569;">Week</th>
            <th style="padding:10px 12px;text-align:right;font-size:12px;color:#475569;">Value</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#475569;">Last Updated</th>
          </tr>
        </thead>
        <tbody>
          ${htmlRows}
        </tbody>
      </table>

      <p style="margin:14px 0 0;font-size:12px;color:#64748b;">A PDF version of this report is attached for records and sharing.</p>
    </div>
  </div>
</div>`;

  const fileName = `kpi-report-${safeFilePart(kpi?.name)}-${String(new Date(generatedAt || new Date()).getFullYear())}.pdf`;

  return {
    subject: `KPI Report: ${kpi?.name || "Performance Update"}`,
    text,
    html,
    rows,
    fileName,
  };
}

export function buildKpiReportPdfBuffer({
  kpi,
  metrics,
  rows,
  generatedAt,
  requestedBy,
  assignedTo,
}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 42, size: "A4" });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const lineHeight = 18;

    doc.fontSize(18).fillColor("#0f172a").text("KPI Performance Report", { align: "left" });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#475569").text(`Generated: ${fmtDate(generatedAt || new Date())}`);
    doc.text(`Requested By: ${requestedBy || "System"}`);
    doc.text(`Assigned To: ${assignedTo || "-"}`);
    doc.moveDown(1);

    doc.fontSize(12).fillColor("#0f172a").text(`KPI: ${kpi?.name || "-"}`);
    doc.fontSize(10).fillColor("#334155").text(`Target: ${Number(kpi?.target || 0).toFixed(2)}`);
    doc.text(`Achieved: ${Number(metrics?.total || 0).toFixed(2)}`);
    doc.text(`Performance: ${Number(metrics?.performance || 0).toFixed(2)}%`);
    doc.text(`Actual Progress: ${Number(metrics?.actualProgress || 0).toFixed(2)}%`);
    doc.text(`Expected Progress: ${Number(metrics?.expectedProgress || 0).toFixed(2)}%`);
    doc.text(`Pace: ${Number(metrics?.meta?.pace || 0).toFixed(2)}%`);
    doc.text(`Status: ${metrics?.status || "Behind"}`);
    doc.moveDown(1);

    doc.fontSize(12).fillColor("#0f172a").text("Submission Details");
    doc.moveDown(0.35);

    const startX = doc.page.margins.left;
    const weekX = startX;
    const valueX = startX + 180;
    const updatedX = startX + 280;
    const maxY = doc.page.height - doc.page.margins.bottom;

    const drawTableHeader = () => {
      doc.fontSize(10).fillColor("#334155").text("Week", weekX, doc.y);
      doc.text("Value", valueX, doc.y - lineHeight + 2, { width: 80, align: "right" });
      doc.text("Last Updated", updatedX, doc.y - lineHeight + 2, { width: 220, align: "left" });
      doc.moveDown(0.5);
      doc.strokeColor("#cbd5e1").lineWidth(1).moveTo(startX, doc.y).lineTo(startX + 500, doc.y).stroke();
      doc.moveDown(0.35);
    };

    drawTableHeader();

    const safeRows = Array.isArray(rows) ? rows : [];
    if (!safeRows.length) {
      doc.fontSize(10).fillColor("#64748b").text("No submissions available yet.");
    } else {
      safeRows.forEach((row) => {
        if (doc.y + lineHeight > maxY) {
          doc.addPage();
          drawTableHeader();
        }
        const y = doc.y;
        doc.fontSize(10).fillColor("#0f172a").text(String(row.week || "-"), weekX, y);
        doc.text(String(row.value || "0.00"), valueX, y, { width: 80, align: "right" });
        doc.fillColor("#334155").text(String(row.updatedAt || "-"), updatedX, y, { width: 220, align: "left" });
        doc.moveDown(0.35);
      });
    }

    doc.end();
  });
}

function monthLabel(month, year) {
  const safeMonth = Math.min(12, Math.max(1, Number(month || 1)));
  const safeYear = Number(year || new Date().getFullYear());
  return new Date(Date.UTC(safeYear, safeMonth - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function statusByProgress(progress) {
  if (progress >= 100) return "Completed";
  if (progress >= 80) return "On Track";
  if (progress >= 60) return "At Risk";
  return "Behind";
}

export function buildKpiPortfolioReportEmail({
  rows,
  generatedAt,
  requestedBy,
  assignedTo,
  month,
  year,
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const generatedAtLabel = fmtDate(generatedAt || new Date());
  const monthYearLabel = monthLabel(month, year);

  const statusCounts = safeRows.reduce(
    (acc, row) => {
      const status = String(row?.status || "Behind");
      if (status === "Completed") acc.completed += 1;
      else if (status === "On Track") acc.onTrack += 1;
      else if (status === "At Risk") acc.atRisk += 1;
      else acc.behind += 1;
      return acc;
    },
    { onTrack: 0, atRisk: 0, behind: 0, completed: 0 }
  );

  const portfolioHealth = safeRows.length
    ? safeRows.reduce((sum, row) => sum + Number(row?.progress || 0), 0) / safeRows.length
    : 0;
  const needsAttention = statusCounts.atRisk + statusCounts.behind;
  const vendorsActive = new Set(safeRows.map((row) => String(row?.assignedTo || "").trim()).filter(Boolean)).size;

  const text = [
    "KPI Portfolio Report",
    "",
    `Reporting Month: ${monthYearLabel}`,
    `Generated: ${generatedAtLabel}`,
    `Requested By: ${requestedBy || "System"}`,
    `Assigned To: ${assignedTo || "-"}`,
    "",
    `Portfolio Health: ${portfolioHealth.toFixed(0)}`,
    `KPIs On Track: ${statusCounts.onTrack}`,
    `Need Attention: ${needsAttention}`,
    `Vendors Active: ${vendorsActive}`,
    `Total KPIs: ${safeRows.length}`,
    "",
    "KPI Details:",
    ...safeRows.map((row, index) => {
      return `${index + 1}. ${row.kpiName} (${row.frequency || "monthly"}, ${row.unit || "number"}) | Vertical: ${row.verticalName} | Expected: ${Number(row.expected || 0).toFixed(2)} | Actual: ${Number(row.actual || 0).toFixed(2)} | Progress: ${Number(row.progress || 0).toFixed(2)}% | Status: ${row.status} | Submissions: ${Number(row.submissionCount || 0)}`;
    }),
  ].join("\n");

  const htmlRows = safeRows.length
    ? safeRows.map((row) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">
          <div style="font-weight:700;color:#0f172a;">${escapeHtml(row.kpiName || "-")}</div>
          <div style="margin-top:4px;font-size:11px;color:#64748b;">${escapeHtml(row.frequency || "monthly")} | ${escapeHtml(row.unit || "number")} | submissions: ${escapeHtml(Number(row.submissionCount || 0))}</div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(row.verticalName || "-")}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${escapeHtml(Number(row.expected || 0).toFixed(2))}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${escapeHtml(Number(row.actual || 0).toFixed(2))}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${escapeHtml(Number(row.progress || 0).toFixed(2))}%</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:${statusColor(row.status)};font-weight:700;">${escapeHtml(row.status || "Behind")}</td>
      </tr>
    `).join("")
    : "<tr><td colspan=\"6\" style=\"padding:14px 12px;color:#64748b;\">No KPI data available for the selected month and year.</td></tr>";

  const html = `
<div style="background:#f8fafc;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="max-width:980px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <div style="padding:20px 24px;background:linear-gradient(135deg,#0f172a,#1e293b);color:#ffffff;">
      <p style="margin:0;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.8;">Command Centre</p>
      <h1 style="margin:8px 0 0;font-size:20px;line-height:1.2;">KPI Portfolio Report</h1>
      <p style="margin:6px 0 0;font-size:13px;opacity:0.85;">Reporting Month: ${escapeHtml(monthYearLabel)}</p>
    </div>

    <div style="padding:20px 24px;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
        <span style="display:inline-block;padding:7px 10px;border-radius:8px;background:#f1f5f9;border:1px solid #e2e8f0;font-size:12px;">Requested By: ${escapeHtml(requestedBy || "System")}</span>
        <span style="display:inline-block;padding:7px 10px;border-radius:8px;background:#f1f5f9;border:1px solid #e2e8f0;font-size:12px;">Assigned To: ${escapeHtml(assignedTo || "-")}</span>
        <span style="display:inline-block;padding:7px 10px;border-radius:8px;background:#ecfeff;border:1px solid #bae6fd;font-size:12px;">Generated: ${escapeHtml(generatedAtLabel)}</span>
      </div>

      <table style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:18px;">
        <tbody>
          <tr>
            <td style="padding:12px;border-bottom:1px solid #e2e8f0;color:#475569;">Portfolio Health</td>
            <td style="padding:12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">${escapeHtml(portfolioHealth.toFixed(0))}</td>
          </tr>
          <tr>
            <td style="padding:12px;border-bottom:1px solid #e2e8f0;color:#475569;">KPIs On Track</td>
            <td style="padding:12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">${escapeHtml(statusCounts.onTrack)}</td>
          </tr>
          <tr>
            <td style="padding:12px;border-bottom:1px solid #e2e8f0;color:#475569;">Need Attention</td>
            <td style="padding:12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">${escapeHtml(needsAttention)}</td>
          </tr>
          <tr>
            <td style="padding:12px;border-bottom:1px solid #e2e8f0;color:#475569;">Vendors Active</td>
            <td style="padding:12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">${escapeHtml(vendorsActive)}</td>
          </tr>
          <tr>
            <td style="padding:12px;color:#475569;">Total KPIs</td>
            <td style="padding:12px;text-align:right;font-weight:700;">${escapeHtml(safeRows.length)}</td>
          </tr>
        </tbody>
      </table>

      <h2 style="margin:0 0 8px;font-size:15px;">KPI Details Across Verticals</h2>
      <table style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
        <thead style="background:#f8fafc;">
          <tr>
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#475569;">KPI</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#475569;">Vertical</th>
            <th style="padding:10px 12px;text-align:right;font-size:12px;color:#475569;">Expected</th>
            <th style="padding:10px 12px;text-align:right;font-size:12px;color:#475569;">Actual</th>
            <th style="padding:10px 12px;text-align:right;font-size:12px;color:#475569;">Progress</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#475569;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${htmlRows}
        </tbody>
      </table>

      <p style="margin:14px 0 0;font-size:12px;color:#64748b;">A PDF with all KPI details across verticals is attached for records and sharing.</p>
    </div>
  </div>
</div>`;

  return {
    subject: `KPI Portfolio Report - ${monthYearLabel}`,
    text,
    html,
    fileName: `kpi-portfolio-report-${String(year)}-${String(month).padStart(2, "0")}.pdf`,
    summary: {
      portfolioHealth,
      onTrack: statusCounts.onTrack,
      needsAttention,
      vendorsActive,
      totalKpis: safeRows.length,
    },
  };
}

export function buildKpiPortfolioPdfBuffer({
  rows,
  generatedAt,
  requestedBy,
  assignedTo,
  month,
  year,
  summary,
}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 42, size: "A4" });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const lineHeight = 18;
    const safeRows = Array.isArray(rows) ? rows : [];
    const monthYearLabel = monthLabel(month, year);

    doc.fontSize(18).fillColor("#0f172a").text("KPI Portfolio Report", { align: "left" });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#475569").text(`Reporting Month: ${monthYearLabel}`);
    doc.text(`Generated: ${fmtDate(generatedAt || new Date())}`);
    doc.text(`Requested By: ${requestedBy || "System"}`);
    doc.text(`Assigned To: ${assignedTo || "-"}`);
    doc.moveDown(0.8);

    doc.fontSize(10).fillColor("#334155").text(`Portfolio Health: ${Number(summary?.portfolioHealth || 0).toFixed(0)}`);
    doc.text(`KPIs On Track: ${Number(summary?.onTrack || 0)}`);
    doc.text(`Need Attention: ${Number(summary?.needsAttention || 0)}`);
    doc.text(`Vendors Active: ${Number(summary?.vendorsActive || 0)}`);
    doc.text(`Total KPIs: ${Number(summary?.totalKpis || 0)}`);
    doc.moveDown(1);

    doc.fontSize(12).fillColor("#0f172a").text("KPI Details Across Verticals");
    doc.moveDown(0.35);

    const startX = doc.page.margins.left;
    const kpiX = startX;
    const verticalX = startX + 170;
    const expectedX = startX + 310;
    const actualX = startX + 380;
    const progressX = startX + 450;
    const statusX = startX + 520;
    const maxY = doc.page.height - doc.page.margins.bottom;

    const drawTableHeader = () => {
      const y = doc.y;
      doc.fontSize(9).fillColor("#334155").text("KPI", kpiX, y, { width: 160 });
      doc.text("Vertical", verticalX, y, { width: 130 });
      doc.text("Expected", expectedX, y, { width: 65, align: "right" });
      doc.text("Actual", actualX, y, { width: 65, align: "right" });
      doc.text("Progress", progressX, y, { width: 65, align: "right" });
      doc.text("Status", statusX, y, { width: 60, align: "left" });
      doc.moveDown(0.6);
      doc.strokeColor("#cbd5e1").lineWidth(1).moveTo(startX, doc.y).lineTo(startX + 560, doc.y).stroke();
      doc.moveDown(0.3);
    };

    drawTableHeader();

    if (!safeRows.length) {
      doc.fontSize(10).fillColor("#64748b").text("No KPI data available for the selected month and year.");
    } else {
      safeRows.forEach((row) => {
        if (doc.y + lineHeight > maxY) {
          doc.addPage();
          drawTableHeader();
        }
        const y = doc.y;
        const kpiLabel = `${String(row.kpiName || "-")} (${String(row.frequency || "monthly")}, ${String(row.unit || "number")})`;
        doc.fontSize(9).fillColor("#0f172a").text(kpiLabel, kpiX, y, { width: 160 });
        doc.fillColor("#334155").text(String(row.verticalName || "-"), verticalX, y, { width: 130 });
        doc.text(String(Number(row.expected || 0).toFixed(2)), expectedX, y, { width: 65, align: "right" });
        doc.text(String(Number(row.actual || 0).toFixed(2)), actualX, y, { width: 65, align: "right" });
        doc.text(`${Number(row.progress || 0).toFixed(2)}%`, progressX, y, { width: 65, align: "right" });
        doc.fillColor(statusColor(row.status)).text(String(row.status || "Behind"), statusX, y, { width: 60, align: "left" });
        doc.moveDown(0.4);
      });
    }

    doc.end();
  });
}
