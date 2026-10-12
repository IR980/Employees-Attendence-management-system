import { useState } from "react";
import {
  Search,
  UserRound,
  CalendarDays,
  Clock,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

import Topbar from "../components/layout/Topbar";
import api from "../services/api";

function currentMonth() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}`;
}

function getItems(response) {
  if (Array.isArray(response)) return response;
  return response?.items ?? response?.data?.items ?? [];
}

function StatCard({ title, value, subtitle, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
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

export default function EmployeeAnalytics() {
  const [empCode, setEmpCode] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadAnalytics(event) {
    event?.preventDefault();

    if (!empCode.trim()) {
      setError("Please enter an employee code.");
      return;
    }

    if (!month) {
      setError("Please select a month.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setData(null);

      const response = await api.get(
        `/analytics/employees/${encodeURIComponent(empCode.trim())}/monthly`,
        { params: { month } },
      );

      setData(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          "Unable to load employee analytics.",
      );
    } finally {
      setLoading(false);
    }
  }

  const summary = data ?? {};
  const records = getItems(summary);
  const presentDays = Number(
    summary.present_days ?? summary.present_count ?? 0,
  );
  const lateCount = Number(summary.late_count ?? 0);
  const lateMinutes = Number(
    summary.total_late_minutes ?? summary.late_minutes ?? 0,
  );
  const leaveCount = Number(summary.leave_count ?? 0);

  const trend = records.map((item) => ({
    date: item.date ?? item.day ?? "",
    present: Number(item.present_count ?? item.present ?? 0),
    late: Number(item.late_count ?? 0),
  }));

  return (
    <main className="min-w-0 flex-1 p-5 md:p-8">
      <Topbar />

      <header className="mb-7 mt-5">
        <p className="text-sm text-slate-500">
          Workspace / Analytics / Employee
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">
          Employee Monthly Analytics
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Review an employee's monthly attendance performance.
        </p>
      </header>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-bold text-slate-900">Select Employee</h2>

        <form
          onSubmit={loadAnalytics}
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <label className="text-sm font-medium text-slate-600">
            Employee Code
            <input
              value={empCode}
              onChange={(event) => setEmpCode(event.target.value)}
              placeholder="e.g. EMP0001"
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-blue-500"
            />
          </label>

          <label className="text-sm font-medium text-slate-600">
            Month
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-blue-500"
            />
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <Search size={18} />
              )}
              {loading ? "Loading..." : "View Analytics"}
            </button>
          </div>
        </form>
      </section>

      {error && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {!data && !loading && !error && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <UserRound className="mx-auto mb-3 text-slate-400" size={36} />
          <h2 className="font-semibold text-slate-800">No employee selected</h2>
          <p className="mt-2 text-sm text-slate-500">
            Enter an employee code and select a month to view analytics.
          </p>
        </div>
      )}

      {data && (
        <>
          <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Present Days"
              value={presentDays}
              subtitle="Monthly present-day total"
              icon={CalendarDays}
            />
            <StatCard
              title="Late Arrivals"
              value={lateCount}
              subtitle="Recorded late arrivals"
              icon={Clock}
            />
            <StatCard
              title="Late Minutes"
              value={lateMinutes}
              subtitle="Total late minutes"
              icon={Clock}
            />
            <StatCard
              title="Leave Count"
              value={leaveCount}
              subtitle="Recorded leave count"
              icon={CalendarDays}
            />
          </section>

          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-1 font-bold text-slate-900">Employee Details</h2>
            <p className="text-sm text-slate-500">
              Employee code: {empCode} · Month: {month}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Additional summary fields are displayed only when returned by the
              backend.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-5 font-bold text-slate-900">
              Monthly Attendance Trend
            </h2>

            {trend.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                The API returned a summary, but no daily trend items were found.
              </p>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="present"
                      name="Present"
                      stroke="#2563eb"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="late"
                      name="Late"
                      stroke="#f59e0b"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        </>
      )}

      <footer className="py-6 text-center text-xs text-slate-400">
        HROne Analytics · FastAPI + MongoDB
      </footer>
    </main>
  );
}
