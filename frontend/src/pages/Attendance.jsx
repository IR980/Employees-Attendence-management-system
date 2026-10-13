import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  ClipboardCheck,
  RefreshCw,
  Search,
  LogIn,
  LogOut,
} from "lucide-react";
import RegularizationModal from "../components/attendance/RegularizationModal";
import Topbar from "../components/layout/Topbar";
import {
  getAttendance,
  punchIn,
  punchOut,
} from "../services/attendanceService";

const PAGE_SIZE = 20;

function getItems(response) {
  if (Array.isArray(response)) return response;
  return response?.items ?? response?.data ?? [];
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function todayString() {
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

function statusClass(status) {
  switch (String(status ?? "").toUpperCase()) {
    case "PRESENT":
      return "bg-emerald-50 text-emerald-700";
    case "WFH":
      return "bg-blue-50 text-blue-700";
    case "ON_DUTY":
      return "bg-violet-50 text-violet-700";
    case "ABSENT":
      return "bg-rose-50 text-rose-700";
    case "LEAVE":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export default function Attendance() {
  const today = todayString();

  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [empCode, setEmpCode] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [status, setStatus] = useState("");

  const [punchCode, setPunchCode] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [selectedRecord, setSelectedRecord] = useState(null);
  const loadAttendance = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = {
        page,
        page_size: PAGE_SIZE,
      };

      if (empCode.trim()) params.emp_code = empCode.trim();
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (status) params.status = status;

      const response = await getAttendance(params);

      setRecords(getItems(response));
      setTotal(
        typeof response?.total === "number"
          ? response.total
          : getItems(response).length,
      );
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          "Unable to load attendance records.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, empCode, dateFrom, dateTo, status]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  async function handlePunch(action) {
    const code = punchCode.trim();

    if (!code) {
      setError("Please enter an employee code first.");
      setMessage("");
      return;
    }

    try {
      setBusy(action);
      setError("");
      setMessage("");

      if (action === "in") {
        await punchIn(code);
      } else {
        await punchOut(code);
      }

      setMessage(
        `Punch ${action === "in" ? "In" : "Out"} request completed successfully.`,
      );

      await loadAttendance();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          `Punch ${action === "in" ? "In" : "Out"} failed.`,
      );
    } finally {
      setBusy("");
    }
  }

  function applyFilters(event) {
    event.preventDefault();

    if (dateFrom && dateTo && dateFrom > dateTo) {
      setError("From date cannot be later than To date.");
      return;
    }

    setError("");
    setPage(1);
    // The effect reloads the data when the page or filters change.
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const visibleRecords = records.filter((record) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;

    return [
      record.emp_code,
      record.employee_name,
      record.name,
      record.status,
    ].some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(query),
    );
  });

  return (
    <main className="min-w-0 flex-1 p-5 md:p-8">
      <Topbar />

      <section className="mb-7 mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm text-slate-500">Workspace / Attendance</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">
            Attendance Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Track employee attendance and punch activity.
          </p>
        </div>

        <button
          type="button"
          onClick={loadAttendance}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </section>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
        >
          {message}
        </div>
      )}

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
            <LogIn size={20} />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Employee Punch</h2>
            <p className="text-sm text-slate-500">
              Enter an employee code to record attendance.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={punchCode}
            onChange={(event) => setPunchCode(event.target.value)}
            placeholder="Enter employee code"
            aria-label="Employee code for punch action"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => handlePunch("in")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <LogIn size={17} />
            {busy === "in" ? "Processing..." : "Punch In"}
          </button>

          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => handlePunch("out")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <LogOut size={17} />
            {busy === "out" ? "Processing..." : "Punch Out"}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-bold text-slate-900">Attendance Records</h2>
          <p className="mt-1 text-sm text-slate-500">
            {total} matching records
          </p>

          <form
            onSubmit={applyFilters}
            className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5"
          >
            <label className="text-xs font-medium text-slate-600">
              Employee Code
              <input
                value={empCode}
                onChange={(event) => setEmpCode(event.target.value)}
                placeholder="e.g. EMP001"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              />
            </label>

            <label className="text-xs font-medium text-slate-600">
              From Date
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              />
            </label>

            <label className="text-xs font-medium text-slate-600">
              To Date
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              />
            </label>

            <label className="text-xs font-medium text-slate-600">
              Status
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="PRESENT">Present</option>
                <option value="WFH">Work From Home</option>
                <option value="ON_DUTY">On Duty</option>
                <option value="ABSENT">Absent</option>
                <option value="LEAVE">Leave</option>
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
              >
                <Search size={16} />
                Apply Filters
              </button>
            </div>
          </form>

          <div className="mt-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search loaded records by employee or status..."
              aria-label="Search loaded attendance records"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 sm:max-w-md"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-212.5 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Employee Code</th>
                <th className="px-5 py-4 font-semibold">Date</th>
                <th className="px-5 py-4 font-semibold">Status</th>
                <th className="px-5 py-4 font-semibold">Punch In</th>
                <th className="px-5 py-4 font-semibold">Punch Out</th>
                <th className="px-5 py-4 font-semibold">Late Minutes</th>
                <th className="px-5 py-4 font-semibold">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-slate-500"
                  >
                    Loading attendance records...
                  </td>
                </tr>
              ) : visibleRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-slate-500"
                  >
                    No attendance records found for these filters.
                  </td>
                </tr>
              ) : (
                visibleRecords.map((record, index) => (
                  <tr
                    key={
                      record._id ?? `${record.emp_code}-${record.date}-${index}`
                    }
                    className="hover:bg-slate-50"
                  >
                    <td className="px-5 py-4 font-semibold text-slate-800">
                      {record.emp_code ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {formatDate(record.date ?? record.attendance_date)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(record.status)}`}
                      >
                        {record.status ?? "Unknown"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {formatDate(record.punch_in ?? record.punched_in_at)}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {formatDate(record.punch_out ?? record.punched_out_at)}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {record.late_minutes ?? "—"}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => setSelectedRecord(record)}
                        className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        <ClipboardCheck size={15} />
                        Regularize
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => current - 1)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>
      {selectedRecord && (
        <RegularizationModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onSuccess={async () => {
            setMessage("Attendance correction saved successfully.");
            setError("");
            await loadAttendance();
          }}
        />
      )}
    </main>
  );
}
