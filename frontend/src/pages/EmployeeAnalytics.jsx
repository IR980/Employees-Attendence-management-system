import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  RefreshCw,
  CalendarDays,
  Clock3,
  Timer,
  TrendingUp,
  UserRound,
  AlertCircle,
  CheckCircle2,
  CalendarCheck,
} from "lucide-react";

import Topbar from "../components/layout/Topbar";
import api from "../services/api";

function formatMinutes(value) {
  const minutes = Number(value ?? 0);
  if (!Number.isFinite(minutes)) return "0 min";

  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatDays(value) {
  const days = Number(value ?? 0);
  return Number.isFinite(days) ? days.toLocaleString("en-IN") : "0";
}

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function MetricCard({ title, value, subtitle, icon: Icon, iconClass }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
          <p className="mt-2 text-xs text-slate-500">{subtitle}</p>
        </div>

        <div className={`rounded-xl p-3 ${iconClass}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

export default function EmployeeAnalytics() {
  const navigate = useNavigate();

  const [empCode, setEmpCode] = useState("EMP0001");
  const [month, setMonth] = useState(getCurrentMonth());
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadAnalytics = useCallback(async () => {
    const code = empCode.trim();

    if (!code) {
      setAnalytics(null);
      setError("Please enter an employee code.");
      return;
    }

    if (!month) {
      setAnalytics(null);
      setError("Please select a month.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        `/analytics/employees/${encodeURIComponent(code)}/monthly`,
        {
          params: { month },
        },
      );

      setAnalytics(response.data);
    } catch (err) {
      setAnalytics(null);
      setError(
        err.response?.data?.detail ??
          err.message ??
          "Unable to load employee analytics.",
      );
    } finally {
      setLoading(false);
    }
  }, [empCode, month, refreshKey]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  function handleSubmit(event) {
    event.preventDefault();
    void loadAnalytics();
  }

  function handleRefresh() {
    setRefreshKey((current) => current + 1);
  }

  const attendancePercentage = Number(analytics?.attendance_pct ?? 0);
  const safePercentage = Number.isFinite(attendancePercentage)
    ? Math.min(100, Math.max(0, attendancePercentage))
    : 0;

  return (
    <main className="min-w-0 flex-1 bg-slate-50 p-5 md:p-8">
      <Topbar />

      <section className="mb-7 mt-5">
        <button
          type="button"
          onClick={() => navigate("/analytics")}
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-blue-700"
        >
          <ArrowLeft size={17} />
          Back to Analytics
        </button>

        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm text-slate-500">
              Workspace / Analytics / Employee Analytics
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">
              Employee Analytics
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Monthly attendance, punctuality and overtime summary.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 items-end gap-4 md:grid-cols-3"
        >
          <div>
            <label
              htmlFor="employee-code"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Employee Code
            </label>

            <div className="relative">
              <UserRound
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                id="employee-code"
                type="text"
                value={empCode}
                onChange={(event) => setEmpCode(event.target.value)}
                placeholder="e.g. EMP0001"
                required
                className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="analytics-month"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Select Month
            </label>

            <div className="relative">
              <CalendarDays
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                id="analytics-month"
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <TrendingUp size={17} />
            {loading ? "Loading..." : "View Analytics"}
          </button>
        </form>
      </section>

      {error && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Unable to load analytics</p>
            <p className="mt-1">{error}</p>
            <button
              type="button"
              onClick={handleRefresh}
              className="mt-2 font-semibold underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {loading && !analytics ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          Loading employee analytics...
        </div>
      ) : analytics ? (
        <>
          <section className="mb-6 flex flex-col justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm text-slate-500">Monthly report</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                {analytics.emp_code}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Reporting month: {analytics.month}
              </p>
            </div>

            <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-medium text-slate-500">
                Attendance Rate
              </p>
              <p className="mt-1 text-2xl font-bold text-blue-700">
                {Number(analytics.attendance_pct ?? 0).toFixed(2)}%
              </p>
            </div>
          </section>

          <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              title="Working Days"
              value={formatDays(analytics.working_days)}
              subtitle="Scheduled working days"
              icon={CalendarDays}
              iconClass="bg-blue-50 text-blue-600"
            />

            <MetricCard
              title="Present Days"
              value={formatDays(analytics.present_days)}
              subtitle="Recorded attendance days"
              icon={CheckCircle2}
              iconClass="bg-emerald-50 text-emerald-600"
            />

            <MetricCard
              title="Leave Days"
              value={formatDays(analytics.leave_days)}
              subtitle="Recorded leave"
              icon={CalendarCheck}
              iconClass="bg-amber-50 text-amber-600"
            />

            <MetricCard
              title="Late Arrivals"
              value={formatDays(analytics.late_count)}
              subtitle="Number of late arrivals"
              icon={Clock3}
              iconClass="bg-rose-50 text-rose-600"
            />

            <MetricCard
              title="Total Late Time"
              value={formatMinutes(analytics.total_late_minutes)}
              subtitle="Accumulated late minutes"
              icon={Timer}
              iconClass="bg-orange-50 text-orange-600"
            />

            <MetricCard
              title="Overtime"
              value={formatMinutes(analytics.total_overtime_minutes)}
              subtitle="Accumulated overtime"
              icon={TrendingUp}
              iconClass="bg-violet-50 text-violet-600"
            />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">Attendance Rate</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Reported monthly attendance percentage
                </p>
              </div>

              <span className="text-lg font-bold text-blue-700">
                {safePercentage.toFixed(2)}%
              </span>
            </div>

            <div
              className="h-3 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-label="Attendance rate"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={safePercentage}
            >
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-500"
                style={{ width: `${safePercentage}%` }}
              />
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              This percentage is displayed as returned by the backend.
              Fractional present days, such as half-days, are preserved.
            </p>
          </section>
        </>
      ) : !error ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          Enter an employee code and select a month to view analytics.
        </div>
      ) : null}
    </main>
  );
}
