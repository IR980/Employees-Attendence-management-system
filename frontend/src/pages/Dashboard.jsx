import { useCallback, useEffect, useState } from "react";
import {
  Users,
  CalendarCheck,
  Clock3,
  CalendarX,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import Topbar from "../components/layout/Topbar";
import StatCard from "../components/dashboard/StatCard";
import QuickActions from "../components/dashboard/QuickActions";
import WorkforceOverview from "../components/dashboard/WorkforceOverview";
import api from "../services/api";

function getItems(response) {
  if (Array.isArray(response)) return response;

  return (
    response?.items ??
    response?.employees ??
    response?.data?.items ??
    response?.data ??
    []
  );
}

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getCurrentMonth() {
  return getToday().slice(0, 7);
}

function StatCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5">
      <div className="h-4 w-28 rounded bg-slate-200" />
      <div className="mt-4 h-9 w-20 rounded bg-slate-200" />
      <div className="mt-4 h-3 w-36 rounded bg-slate-100" />
    </div>
  );
}

export default function Dashboard() {
  const [employeesTotal, setEmployeesTotal] = useState(0);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [departmentSummary, setDepartmentSummary] = useState([]);
  const [lateLeaderboard, setLateLeaderboard] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const today = getToday();
  const month = getCurrentMonth();

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const results = await Promise.allSettled([
        api.get("/employees", {
          params: { page: 1, page_size: 1 },
        }),
        api.get("/attendance", {
          params: {
            date_from: today,
            date_to: today,
            page: 1,
            page_size: 100,
          },
        }),
        api.get("/analytics/departments/summary", {
          params: { month },
        }),
        api.get("/analytics/leaderboard/late", {
          params: { month, limit: 5 },
        }),
      ]);

      const failures = results.filter((result) => result.status === "rejected");

      const employeeResult = results[0];
      const attendanceResult = results[1];
      const departmentResult = results[2];
      const leaderboardResult = results[3];

      if (employeeResult.status === "fulfilled") {
        const data = employeeResult.value.data;
        const items = getItems(data);

        setEmployeesTotal(
          typeof data?.total === "number" ? data.total : items.length,
        );
      } else {
        setEmployeesTotal(0);
      }

      if (attendanceResult.status === "fulfilled") {
        setAttendanceRecords(getItems(attendanceResult.value.data));
      } else {
        setAttendanceRecords([]);
      }

      if (departmentResult.status === "fulfilled") {
        setDepartmentSummary(getItems(departmentResult.value.data));
      } else {
        setDepartmentSummary([]);
      }

      if (leaderboardResult.status === "fulfilled") {
        setLateLeaderboard(getItems(leaderboardResult.value.data));
      } else {
        setLateLeaderboard([]);
      }

      if (failures.length === results.length) {
        setError(
          "Dashboard data could not be loaded. Check that the backend is running.",
        );
      } else if (failures.length > 0) {
        setError(
          `${failures.length} dashboard data request(s) failed. Some statistics may be unavailable.`,
        );
      }
    } catch (err) {
      setError(
        err.response?.data?.detail ??
          err.message ??
          "Unable to load dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }, [today, month, refreshKey]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const presentCount = attendanceRecords.filter((record) =>
    ["PRESENT", "WFH", "ON_DUTY"].includes(
      String(record.status ?? "").toUpperCase(),
    ),
  ).length;

  const absentCount = attendanceRecords.filter(
    (record) => String(record.status ?? "").toUpperCase() === "ABSENT",
  ).length;

  const lateCount = attendanceRecords.filter(
    (record) => Number(record.late_minutes ?? 0) > 0,
  ).length;

  const chartData = departmentSummary.map((item) => ({
    department: item.department ?? "Other",
    presentDays: Number(item.present_days ?? 0),
    lateCount: Number(item.late_count ?? 0),
    headcount: Number(item.headcount ?? 0),
  }));

  function getLeaderboardName(item) {
    return (
      item.name ??
      item.employee_name ??
      item.emp_name ??
      item.emp_code ??
      item.employee_id ??
      "Employee"
    );
  }

  function getLeaderboardCode(item) {
    return item.emp_code ?? item.employee_id ?? item._id ?? "—";
  }

  function getLeaderboardLateMinutes(item) {
    return Number(
      item.total_late_minutes ?? item.late_minutes ?? item.minutes_late ?? 0,
    );
  }

  return (
    <main className="min-w-0 flex-1 bg-slate-50 p-5 md:p-8">
      <Topbar />

      <section className="mb-7 mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm text-slate-500">Workspace / Dashboard</p>

          <h1 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">
            Dashboard
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Employee workforce and attendance overview for {today}.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setRefreshKey((current) => current + 1)}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh Dashboard
        </button>
      </section>

      {error && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
        >
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Dashboard data warning</p>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      )}

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Total Employees"
              value={employeesTotal}
              description="Registered in the employee directory"
              icon={Users}
              color="bg-blue-50 text-blue-600"
            />

            <StatCard
              title="Present Today"
              value={presentCount}
              description="Present, work from home and on duty"
              icon={CalendarCheck}
              color="bg-emerald-50 text-emerald-600"
            />

            <StatCard
              title="Late Arrivals Today"
              value={lateCount}
              description="Records with late minutes above zero"
              icon={Clock3}
              color="bg-amber-50 text-amber-600"
            />

            <StatCard
              title="Absent Today"
              value={absentCount}
              description="Explicitly marked absent"
              icon={CalendarX}
              color="bg-rose-50 text-rose-600"
            />
          </>
        )}
      </section>

      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <WorkforceOverview
          totalEmployees={employeesTotal}
          loading={loading}
          onRefresh={() => setRefreshKey((current) => current + 1)}
        />

        <QuickActions />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="font-bold text-slate-900">Department Overview</h2>
            <p className="mt-1 text-sm text-slate-500">
              Monthly late-arrival counts by department · {month}
            </p>
          </div>

          {loading && chartData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-500">
              Loading department data...
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-500">
              No department summary available.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="department"
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="lateCount"
                    name="Late Arrivals"
                    fill="#2563eb"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="font-bold text-slate-900">Monthly Late Arrivals</h2>
            <p className="mt-1 text-sm text-slate-500">
              Employees returned by the late-arrival leaderboard · {month}
            </p>
          </div>

          {loading && lateLeaderboard.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-500">
              Loading leaderboard...
            </div>
          ) : lateLeaderboard.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-500">
              No leaderboard records available.
            </div>
          ) : (
            <div className="space-y-3">
              {lateLeaderboard.map((item, index) => (
                <div
                  key={`${getLeaderboardCode(item)}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">
                      {index + 1}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {getLeaderboardName(item)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {getLeaderboardCode(item)}
                      </p>
                    </div>
                  </div>

                  <span className="shrink-0 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                    {getLeaderboardLateMinutes(item)} min
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <p className="text-xs leading-5 text-slate-500">
        Attendance cards use records returned by the API for today. The
        displayed counts depend on the records returned by the current
        attendance page size.
      </p>
    </main>
  );
}
