import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Users, UserCheck, UserX, Clock3 } from "lucide-react";

import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import StatCard from "./components/dashboard/StatCard";
import WorkforceOverview from "./components/dashboard/WorkforceOverview";
import QuickActions from "./components/dashboard/QuickActions";
import EmployeeTable from "./components/employees/EmployeeTable";

import Employees from "./pages/Employees";
import Attendance from "./pages/Attendance";
import Analytics from "./pages/Analytics";
import EmployeeAnalytics from "./pages/EmployeeAnalytics";
import EmployeeDetails from "./pages/EmployeeDetails";




import { getEmployees } from "./services/employeeService";
import { getAttendance } from "./services/attendanceService";

function normalizeItems(response) {
  if (Array.isArray(response)) return response;

  return response?.items ?? response?.employees ?? response?.data ?? [];
}

function getTodayIST() {
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

function Dashboard() {
  const [employees, setEmployees] = useState([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const today = getTodayIST();

      const [employeeResponse, attendanceResponse] = await Promise.all([
        getEmployees(1, 100),
        getAttendance({
          date_from: today,
          date_to: today,
          page: 1,
          page_size: 100,
        }),
      ]);

      const employeeItems = normalizeItems(employeeResponse);
      const attendanceItems = normalizeItems(attendanceResponse);

      setEmployees(employeeItems);

      setTotalEmployees(
        typeof employeeResponse?.total === "number"
          ? employeeResponse.total
          : employeeItems.length,
      );

      setAttendance(attendanceItems);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          "Unable to load dashboard data.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const presentCount = attendance.filter((record) =>
    ["PRESENT", "WFH", "ON_DUTY"].includes(
      String(record.status ?? "").toUpperCase(),
    ),
  ).length;

  const absentCount = attendance.filter(
    (record) => String(record.status ?? "").toUpperCase() === "ABSENT",
  ).length;

  const lateCount = attendance.filter(
    (record) => Number(record.late_minutes) > 0,
  ).length;

  const stats = [
    {
      title: "Total Employees",
      value: loading ? "…" : totalEmployees,
      description: "Registered employees",
      icon: Users,
      color: "bg-blue-50 text-blue-600",
    },
    {
      title: "Present Today",
      value: loading ? "…" : presentCount,
      description: "Present, WFH and on-duty",
      icon: UserCheck,
      color: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Absent Today",
      value: loading ? "…" : absentCount,
      description: "Explicitly marked absent",
      icon: UserX,
      color: "bg-rose-50 text-rose-600",
    },
    {
      title: "Late Arrivals",
      value: loading ? "…" : lateCount,
      description: "Late minutes greater than zero",
      icon: Clock3,
      color: "bg-amber-50 text-amber-600",
    },
  ];

  return (
    <main className="min-w-0 flex-1 p-5 md:p-8">
      <Topbar />

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={loadDashboard}
            className="mt-2 font-semibold underline"
          >
            Retry loading dashboard
          </button>
        </div>
      )}

      <section className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </section>

      <section className="mb-8 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <WorkforceOverview
          totalEmployees={totalEmployees}
          loading={loading}
          onRefresh={loadDashboard}
        />
        <QuickActions />
      </section>

      <EmployeeTable
        employees={employees}
        loading={loading}
        error={error}
        onRetry={loadDashboard}
      />

      <footer className="py-6 text-center text-xs text-slate-400">
        HROne Attendance Portal · React + FastAPI + MongoDB
      </footer>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 md:flex">
        <Sidebar />

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/attendance" element = {<Attendance/>} />
          <Route path="/analytics" element ={<Analytics/>} />
          <Route path="/analytics/employee" element = {<EmployeeAnalytics/>} />
          <Route path="/employees/:empCode" element = {<EmployeeDetails/>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
