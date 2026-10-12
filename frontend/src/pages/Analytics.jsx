import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  Clock3,
  RefreshCw,
  Users,
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from "recharts";

import Topbar from "../components/layout/Topbar";
import api from "../services/api";

const COLORS = {
  blue: "#2563eb",
  green: "#16a34a",
  orange: "#f59e0b",
  purple: "#7c3aed",
};

function getCurrentMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}`;
}

function getToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function getItems(response) {
  if (Array.isArray(response)) return response;

  return (
    response?.items ??
    response?.data?.items ??
    response?.data ??
    response?.results ??
    []
  );
}

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString("en-IN", {
    maximumFractionDigits: 1,
  });
}

function formatPercent(value) {
  if (value == null || !Number.isFinite(Number(value))) {
    return "No data";
  }

  return `${Number(value).toFixed(1)}%`;
}

function formatDateLabel(value) {
  if (!value) return "";

  const parts = String(value).split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : String(value);
}

function StatCard({ title, value, subtitle, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>

          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>

          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>

        <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 font-bold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function EmptyState({ children }) {
  return (
    <div className="flex min-h-64 items-center justify-center text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

export default function Analytics() {
  const initialMonth = getCurrentMonth();
  const today = getToday();

  const [month, setMonth] = useState(initialMonth);
  const [department, setDepartment] = useState("");
  const [fromDate, setFromDate] = useState(`${initialMonth}-01`);
  const [toDate, setToDate] = useState(today);

  const [departments, setDepartments] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [trend, setTrend] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState([]);

  const loadAnalytics = useCallback(async () => {
    if (!month) {
      setError("Please select a month.");
      return;
    }

    if (!fromDate || !toDate || fromDate > toDate) {
      setError("Please select a valid trend date range.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setWarnings([]);

      const requests = [
        api.get("/analytics/departments/summary", {
          params: {
            month,
            ...(department ? { department } : {}),
          },
        }),

        api.get("/analytics/leaderboard/late", {
          params: {
            month,
            limit: 10,
          },
        }),
      ];

      const results = await Promise.allSettled(requests);

      const summaryResult = results[0];
      const leaderboardResult = results[1];

      if (summaryResult.status === "fulfilled") {
        setDepartments(getItems(summaryResult.value.data));
      } else {
        setDepartments([]);
      }

      if (leaderboardResult.status === "fulfilled") {
        setLeaderboard(getItems(leaderboardResult.value.data));
      } else {
        setLeaderboard([]);
      }

      const nextWarnings = [];

      if (summaryResult.status === "rejected") {
        nextWarnings.push("Department summary could not be loaded.");
      }

      if (leaderboardResult.status === "rejected") {
        nextWarnings.push("Late-arrival leaderboard could not be loaded.");
      }

      setWarnings(nextWarnings);

      // The trend endpoint requires a real department path parameter.
      // When no department is selected, use the first available department.
      const summaryItems =
        summaryResult.status === "fulfilled"
          ? getItems(summaryResult.value.data)
          : [];

      const availableDepartments = summaryItems
        .map((item) => item.department)
        .filter(Boolean);

      const selectedDepartment = department || availableDepartments[0] || "";

      if (!selectedDepartment) {
        setTrend([]);
        setWarnings((current) => [
          ...current,
          "Trend is unavailable because no department was returned by the summary API.",
        ]);
        return;
      }

      try {
        const trendResponse = await api.get(
          `/analytics/departments/${encodeURIComponent(
            selectedDepartment,
          )}/trend`,
          {
            params: {
              from: fromDate,
              to: toDate,
            },
          },
        );

        setTrend(getItems(trendResponse.data));
      } catch {
        setTrend([]);
        setWarnings((current) => [
          ...current,
          `Trend data for ${selectedDepartment} could not be loaded.`,
        ]);
      }
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          "Unable to load analytics.",
      );
    } finally {
      setLoading(false);
    }
  }, [month, department, fromDate, toDate]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  // The summary API returns headcount, present_days, late_count,
  // total_late_minutes and leave_count.
  const departmentChart = useMemo(
    () =>
      departments.map((item) => ({
        department: item.department ?? "Unknown",
        headcount: Number(item.headcount ?? 0),
        presentDays: Number(item.present_days ?? 0),
        lateCount: Number(item.late_count ?? 0),
        lateMinutes: Number(item.total_late_minutes ?? 0),
        leaveCount: Number(item.leave_count ?? 0),
        onDutyCount: Number(item.on_duty_count ?? 0),
        avgWorkHours:
          item.avg_work_hours == null ? null : Number(item.avg_work_hours),
      })),
    [departments],
  );

  // The trend API returns attendance_rate and moving_avg_7d
  // as decimal ratios, e.g. 1 = 100% and 0.2 = 20%.
  const trendChart = useMemo(
    () =>
      trend.map((item) => ({
        date: item.date ?? "",
        headcount: Number(item.headcount ?? 0),
        present: Number(item.present_count ?? 0),
        late: Number(item.late_count ?? 0),
        attendanceRate:
          item.attendance_rate == null
            ? null
            : Number(item.attendance_rate) * 100,
        movingAverage:
          item.moving_avg_7d == null ? null : Number(item.moving_avg_7d) * 100,
        workingDay: Boolean(item.is_working_day),
      })),
    [trend],
  );

  const totalHeadcount = departmentChart.reduce(
    (sum, item) => sum + item.headcount,
    0,
  );

  const totalPresentDays = departmentChart.reduce(
    (sum, item) => sum + item.presentDays,
    0,
  );

  const totalLateArrivals = departmentChart.reduce(
    (sum, item) => sum + item.lateCount,
    0,
  );

  const totalLateMinutes = departmentChart.reduce(
    (sum, item) => sum + item.lateMinutes,
    0,
  );

  const selectedDepartment = department || departmentChart[0]?.department || "";

  const handleDepartmentChange = (event) => {
    setDepartment(event.target.value);
  };

  return (
    <main className="min-w-0 flex-1 p-5 md:p-8">
      <Topbar />

      <header className="mb-7 mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm text-slate-500">Workspace / Analytics</p>

          <h1 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">
            Attendance Analytics
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Explore monthly workforce attendance and trends.
          </p>
        </div>

        <button
          type="button"
          onClick={loadAnalytics}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          {error}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <AlertCircle size={18} />
            Some analytics data is unavailable
          </div>

          <ul className="list-inside list-disc space-y-1">
            {warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Departments"
          value={loading ? "…" : departmentChart.length}
          subtitle="Departments in monthly summary"
          icon={Users}
        />

        <StatCard
          title="Headcount"
          value={loading ? "…" : formatNumber(totalHeadcount)}
          subtitle="Sum of department headcounts"
          icon={Users}
        />

        <StatCard
          title="Present Days"
          value={loading ? "…" : formatNumber(totalPresentDays)}
          subtitle="Monthly present-day total"
          icon={CalendarDays}
        />

        <StatCard
          title="Late Arrivals"
          value={loading ? "…" : formatNumber(totalLateArrivals)}
          subtitle={`${formatNumber(totalLateMinutes)} total late minutes`}
          icon={Clock3}
        />
      </section>

      <Section title="Analytics Filters">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-medium text-slate-600">
            Month
            <input
              type="month"
              value={month}
              onChange={(event) => {
                const nextMonth = event.target.value;
                setMonth(nextMonth);

                if (nextMonth) {
                  setFromDate(`${nextMonth}-01`);
                }
              }}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500"
            />
          </label>

          <label className="text-sm font-medium text-slate-600">
            Department
            <select
              value={department}
              onChange={handleDepartmentChange}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-blue-500"
            >
              <option value="">First available department</option>

              {departmentChart.map((item) => (
                <option key={item.department} value={item.department}>
                  {item.department}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-600">
            Trend From
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500"
            />
          </label>

          <label className="text-sm font-medium text-slate-600">
            Trend To
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500"
            />
          </label>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Trend department: {selectedDepartment || "Not available"}. Changes to
          filters automatically reload the analytics.
        </p>
      </Section>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section title="Department Summary">
          {loading ? (
            <EmptyState>Loading department summary...</EmptyState>
          ) : departmentChart.length === 0 ? (
            <EmptyState>No department summary data available.</EmptyState>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={departmentChart}
                  margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="department"
                    tick={{ fontSize: 12 }}
                    interval={0}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="headcount"
                    fill={COLORS.blue}
                    name="Headcount"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="presentDays"
                    fill={COLORS.green}
                    name="Present Days"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="lateCount"
                    fill={COLORS.orange}
                    name="Late Count"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {!loading && departmentChart.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-120 text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Department</th>
                    <th className="px-3 py-2">Headcount</th>
                    <th className="px-3 py-2">Present Days</th>
                    <th className="px-3 py-2">Late Minutes</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {departmentChart.map((item) => (
                    <tr key={item.department}>
                      <td className="px-3 py-2 font-medium">
                        {item.department}
                      </td>
                      <td className="px-3 py-2">
                        {formatNumber(item.headcount)}
                      </td>
                      <td className="px-3 py-2">
                        {formatNumber(item.presentDays)}
                      </td>
                      <td className="px-3 py-2">
                        {formatNumber(item.lateMinutes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Department Attendance Trend">
          {loading ? (
            <EmptyState>Loading attendance trend...</EmptyState>
          ) : trendChart.length === 0 ? (
            <EmptyState>
              No trend data available. Check the selected department and date
              range.
            </EmptyState>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-500">
                <span>
                  Working days:{" "}
                  {trendChart.filter((item) => item.workingDay).length}
                </span>
                <span>
                  Present:{" "}
                  {formatNumber(
                    trendChart.reduce((sum, item) => sum + item.present, 0),
                  )}
                </span>
                <span>
                  Late:{" "}
                  {formatNumber(
                    trendChart.reduce((sum, item) => sum + item.late, 0),
                  )}
                </span>
              </div>

              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trendChart}
                    margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateLabel}
                      tick={{ fontSize: 11 }}
                      minTickGap={18}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip
                      labelFormatter={(value) => `Date: ${value}`}
                      formatter={(value, name) => [formatPercent(value), name]}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="attendanceRate"
                      name="Attendance Rate"
                      stroke={COLORS.blue}
                      strokeWidth={2}
                      connectNulls={false}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="movingAverage"
                      name="7-Day Moving Average"
                      stroke={COLORS.green}
                      strokeWidth={2}
                      connectNulls={false}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Attendance rates are displayed as percentages. Non-working days
                with null rates are left as gaps.
              </p>
            </>
          )}
        </Section>

        <div className="xl:col-span-2">
          <Section title="Late Arrival Leaderboard">
            {loading ? (
              <EmptyState>Loading leaderboard...</EmptyState>
            ) : leaderboard.length === 0 ? (
              <EmptyState>No late-arrival records available.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-162.5 text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Employee Code</th>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Late Count</th>
                      <th className="px-4 py-3">Late Minutes</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {leaderboard.map((item, index) => (
                      <tr
                        key={item.emp_code ?? item.employee_id ?? index}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="px-4 py-3 font-semibold">{index + 1}</td>

                        <td className="px-4 py-3">
                          {item.emp_code ?? item.employee_id ?? "—"}
                        </td>

                        <td className="px-4 py-3">
                          {item.employee_name ?? item.name ?? "—"}
                        </td>

                        <td className="px-4 py-3">
                          {formatNumber(item.late_count ?? item.late_days ?? 0)}
                        </td>

                        <td className="px-4 py-3">
                          {formatNumber(
                            item.late_minutes ?? item.total_late_minutes ?? 0,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      </div>

      <footer className="py-6 text-center text-xs text-slate-400">
        HROne Analytics · FastAPI + MongoDB
      </footer>
    </main>
  );
}
