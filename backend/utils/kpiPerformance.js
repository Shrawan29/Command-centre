function normalizeWeek(value = "") {
  const match = String(value).trim().match(/^(\d{4})-W(\d{1,2})$/i);
  if (!match) return null;
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  return `${match[1]}-W${String(week).padStart(2, "0")}`;
}

function isoWeekString(date) {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function startOfIsoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d;
}

function endOfIsoWeek(date) {
  const start = startOfIsoWeek(date);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return end;
}

function weeksInRange(startUtc, endUtc) {
  const d = new Date(startUtc);
  const set = new Set();

  while (d <= endUtc) {
    set.add(isoWeekString(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }

  return Array.from(set).sort();
}

function getPeriodBounds(frequency, now) {
  const year = now.getFullYear();
  const month = now.getMonth();

  if (frequency === "daily") {
    const start = new Date(Date.UTC(year, month, now.getDate()));
    const end = new Date(start);
    end.setUTCHours(23, 59, 59, 999);
    return { start, end };
  }

  if (frequency === "weekly") {
    return { start: startOfIsoWeek(now), end: endOfIsoWeek(now) };
  }

  if (frequency === "monthly") {
    return {
      start: new Date(Date.UTC(year, month, 1)),
      end: new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)),
    };
  }

  if (frequency === "quarterly") {
    const qStartMonth = Math.floor(month / 3) * 3;
    return {
      start: new Date(Date.UTC(year, qStartMonth, 1)),
      end: new Date(Date.UTC(year, qStartMonth + 3, 0, 23, 59, 59, 999)),
    };
  }

  // yearly (default fallback)
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
  };
}

function sumValues(submissions) {
  return submissions.reduce((sum, s) => sum + Number(s?.value || 0), 0);
}

function getSubmissionTime(submission) {
  return new Date(submission?.updatedAt || submission?.createdAt || 0).getTime();
}

export function collapseWeeklySubmissions(submissions = []) {
  const latestByWeek = new Map();
  const passthrough = [];

  for (const submission of submissions) {
    const week = normalizeWeek(submission?.week);

    // If week is missing/invalid, keep the record as-is instead of dropping it.
    if (!week) {
      passthrough.push(submission);
      continue;
    }

    const existing = latestByWeek.get(week);
    if (!existing || getSubmissionTime(submission) >= getSubmissionTime(existing)) {
      latestByWeek.set(week, submission);
    }
  }

  return [...passthrough, ...Array.from(latestByWeek.values())];
}

export function computeKpiMetrics(kpi, submissions, now = new Date()) {
  const target = Number(kpi?.target || 0);
  const frequency = String(kpi?.frequency || "monthly").toLowerCase();
  const safeSubmissions = collapseWeeklySubmissions(
    Array.isArray(submissions) ? submissions : []
  );

  if (target <= 0) {
    return {
      total: 0,
      performance: 0,
      completion: 0,
      actualProgress: 0,
      expectedProgress: 0,
      status: "Behind",
      meta: { mode: frequency, target },
    };
  }

  const period = getPeriodBounds(frequency, now);
  const currentWeek = isoWeekString(now);
  const periodWeekKeys = weeksInRange(period.start, period.end);

  let periodSubmissions = [];
  let totalUnits = 1;
  let elapsedUnits = 1;
  let unitLabel = "period";

  if (frequency === "daily") {
    periodSubmissions = safeSubmissions.filter((s) => {
      if (!s?.createdAt) return false;
      const created = new Date(s.createdAt);
      return created >= period.start && created <= period.end;
    });
    totalUnits = 1;
    elapsedUnits = 1;
    unitLabel = "day";
  } else if (frequency === "weekly") {
    periodSubmissions = safeSubmissions.filter((s) => normalizeWeek(s?.week) === currentWeek);
    const day = now.getDay() === 0 ? 7 : now.getDay();
    totalUnits = 7;
    elapsedUnits = day;
    unitLabel = "day";
  } else {
    periodSubmissions = safeSubmissions.filter((s) => {
      const w = normalizeWeek(s?.week);
      return Boolean(w && periodWeekKeys.includes(w));
    });
    totalUnits = Math.max(1, periodWeekKeys.length);
    elapsedUnits = Math.max(1, periodWeekKeys.filter((w) => w <= currentWeek).length);
    unitLabel = "week";
  }

  const total = sumValues(periodSubmissions);
  const perUnitTarget = target / totalUnits;
  const expectedToDate = perUnitTarget * elapsedUnits;
  const actualProgress = (total / target) * 100;
  const expectedProgress = (elapsedUnits / totalUnits) * 100;
  const pace = expectedToDate > 0 ? (total / expectedToDate) * 100 : 0;
  const completion = actualProgress;

  // Status is based on actual vs expected progress, with explicit Completed.
  let status = "Behind";
  if (actualProgress >= 100) {
    status = "Completed";
  } else if (actualProgress >= expectedProgress) {
    status = "On Track";
  } else if (actualProgress >= expectedProgress - 10) {
    status = "At Risk";
  }

  return {
    total,
    performance: actualProgress,
    completion,
    actualProgress,
    expectedProgress,
    status,
    meta: {
      mode: frequency,
      target,
      periodStart: period.start,
      periodEnd: period.end,
      currentWeek,
      totalUnits,
      elapsedUnits,
      unitLabel,
      perUnitTarget,
      expectedToDate,
      pace,
      riskBand: 10,
    },
  };
}
