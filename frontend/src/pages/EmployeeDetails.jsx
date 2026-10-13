import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  RefreshCw,
  Clock3,
  Timer,
  History,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";

import Topbar from "../components/layout/Topbar";
import { getAttendance } from "../services/attendanceService";
const PAGE_SIZE = 10;

function getItems(response) {
  if (Array.isArray(response)) return response;

  return (
    response?.items ??
    response?.attendance ??
    response?.data?.items ??
    response?.data ??
    []
  );
}

function formatDate(value) {
  if (!value) return "—";

  const parts = String(value).split("-");

  if (parts.length === 3) {
    const date = new Date(
      Number(parts[0]),
      Number(parts[1]) - 1,
      Number(parts[2]),
    );

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("en-IN");
}

function formatTimestamp(value) {
  if (value == null) return "—";

  const date = new Date(Number(value));

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateTime(value) {
  if (value == null) return "—";

  const date = new Date(Number(value));

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function getStatusClass(status) {
  const normalized = String(status ?? "").toUpperCase();

  if (["PRESENT", "WFH", "ON_DUTY"].includes(normalized)) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
  }

  if (normalized === "ABSENT") {
    return "bg-rose-50 text-rose-700 ring-rose-600/20";
  }

  if (normalized === "LEAVE") {
    return "bg-amber-50 text-amber-700 ring-amber-600/20";
  }

  return "bg-slate-100 text-slate-600 ring-slate-500/20";
}

function getChangedFields(changes) {
  if (!changes || typeof changes !== "object") return [];

  return Object.entries(changes);
}

export default function EmployeeDetails() {
  const { empCode } = useParams();
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedHistory, setExpandedHistory] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadAttendance() {
      try {
        setLoading(true);
        setError("");

        const [year, monthNumber] = month.split("-");

        const dateFrom = `${year}-${monthNumber}-01`;

        const lastDay = new Date(
          Number(year),
          Number(monthNumber),
          0,
        ).getDate();

        const dateTo = `${year}-${monthNumber}-${String(lastDay).padStart(
          2,
          "0",
        )}`;

        const response = await getAttendance({
          emp_code: empCode,
          date_from: dateFrom,
          date_to: dateTo,
          page,
          page_size: PAGE_SIZE,
        });

        if (cancelled) return;

        const items = getItems(response);

        setRecords(items);
        setTotal(
          typeof response?.total === "number" ? response.total : items.length,
        );
      } catch (err) {
        if (!cancelled) {
          setRecords([]);
          setTotal(0);
          setError(
            err.response?.data?.detail ??
              err.message ??
              "Unable to load attendance history.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAttendance();

    return () => {
      cancelled = true;
    };
  }, [empCode, month, page, refreshKey]);

  function handleMonthChange(event) {
    setMonth(event.target.value);
    setPage(1);
    setExpandedHistory({});
  }

  function refreshAttendance() {
    // Changing the page state triggers a new request when possible.
    // The explicit refresh counter below guarantees a request even
    // when the current page is already page 1.
    setRefreshKey((current) => current + 1);
  }

  useEffect(() => {
    // Refresh is handled by the attendance loading effect.
    // This effect intentionally has no independent side effects.
  }, [refreshKey]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const presentRecords = records.filter((record) =>
    ["PRESENT", "WFH", "ON_DUTY"].includes(
      String(record.status ?? "").toUpperCase(),
    ),
  ).length;

  const absentRecords = records.filter(
    (record) => String(record.status ?? "").toUpperCase() === "ABSENT",
  ).length;

  const totalLateMinutes = records.reduce(
    (sum, record) => sum + Number(record.late_minutes ?? 0),
    0,
  );

  const totalWorkHours = records.reduce(
    (sum, record) => sum + Number(record.work_hours ?? 0),
    0,
  );

  return (
    <main className="min-w-0 flex-1 bg-slate-50 p-5 md:p-8">
      <Topbar />

      <section className="mb-6 mt-5">
        <button
          type="button"
          onClick={() => navigate("/employees")}
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-blue-700"
        >
          <ArrowLeft size={17} />
          Back to Employees
        </button>

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="text-sm text-slate-500">
              Workspace / Employees / Details
            </div>

            <h1 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">
              Employee Details
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Attendance overview for employee{" "}
              <span className="font-semibold text-slate-700">
                {decodeURIComponent(empCode ?? "")}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <CalendarDays size={18} className="text-blue-600" />

              <input
                type="month"
                value={month}
                onChange={handleMonthChange}
                aria-label="Select attendance month"
                className="min-w-0 bg-transparent text-sm outline-none"
              />
            </label>

            <button
              type="button"
              onClick={refreshAttendance}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Unable to load attendance</p>
            <p className="mt-1">{error}</p>
            <button
              type="button"
              onClick={refreshAttendance}
              className="mt-2 font-semibold underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Records This Page
            </p>
            <CalendarDays size={20} className="text-blue-600" />
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {loading ? "…" : total}
          </p>
          <p className="mt-1 text-xs text-slate-500">Selected month</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Present Records
            </p>
            <Clock3 size={20} className="text-emerald-600" />
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {loading ? "…" : presentRecords}
          </p>
          <p className="mt-1 text-xs text-slate-500">On the current page</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Total Work Hours
            </p>
            <Timer size={20} className="text-violet-600" />
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {loading ? "…" : totalWorkHours.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Sum of recorded hours on this page
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Late Minutes</p>
            <History size={20} className="text-amber-600" />
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {loading ? "…" : totalLateMinutes}
          </p>
          <p className="mt-1 text-xs text-slate-500">Sum on the current page</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Attendance History</h2>
            <p className="mt-1 text-sm text-slate-500">
              {total} matching records · {month}
            </p>
          </div>

          <span className="text-xs text-slate-500">
            {absentRecords} absent records on this page
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-275 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-4">Date</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Punch In</th>
                <th className="px-5 py-4">Punch Out</th>
                <th className="px-5 py-4">Work Hours</th>
                <th className="px-5 py-4">Late (min)</th>
                <th className="px-5 py-4">Half Day</th>
                <th className="px-5 py-4">History</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-slate-500"
                  >
                    Loading attendance records...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-slate-500"
                  >
                    Attendance could not be loaded.
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-slate-500"
                  >
                    No attendance records found for this employee and month.
                  </td>
                </tr>
              ) : (
                records.map((record, index) => {
                  const status = record.status ?? "Unknown";
                  const history = Array.isArray(record.history)
                    ? record.history
                    : [];
                  const historyKey = `${record.emp_code}-${record.date}-${index}`;
                  const isExpanded = Boolean(expandedHistory[historyKey]);
                  

                  return (
                    <tr
                      key={historyKey}
                      className="align-top transition hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-700">
                        {formatDate(record.date)}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getStatusClass(
                            status,
                          )}`}
                        >
                          {status}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        {formatTimestamp(record.punch_in)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        {formatTimestamp(record.punch_out)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        {record.work_hours == null
                          ? "—"
                          : `${Number(record.work_hours).toFixed(2)} h`}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {record.late_minutes ?? 0}
                      </td>

                      <td className="px-5 py-4">
                        {record.half_day ? (
                          <span className="font-semibold text-amber-700">
                            Yes
                          </span>
                        ) : (
                          <span className="text-slate-500">No</span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {history.length > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedHistory((current) => ({
                                ...current,
                                [historyKey]: !current[historyKey],
                              }))
                            }
                            className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            <History size={14} />
                            {isExpanded
                              ? "Hide"
                              : `${history.length} change(s)`}
                            {isExpanded ? (
                              <ChevronUp size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">
                            No changes
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading &&
          !error &&
          records.some(
            (record) =>
              Array.isArray(record.history) && record.history.length > 0,
          ) && (
            <div className="border-t border-slate-100 bg-slate-50/50 p-5">
              <h3 className="mb-4 font-semibold text-slate-800">
                Attendance Correction History
              </h3>

              <div className="space-y-4">
                {records.map((record, index) => {
                  const history = Array.isArray(record.history)
                    ? record.history
                    : [];
                  const historyKey = `${record.emp_code}-${record.date}-${index}`;

                  if (!expandedHistory[historyKey] || history.length === 0) {
                    return null;
                  }

                  return history.map((entry, entryIndex) => (
                    <article
                      key={`${historyKey}-${entryIndex}`}
                      className="rounded-xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex flex-col justify-between gap-2 sm:flex-row">
                        <div>
                          <p className="font-semibold text-slate-800">
                            {record.emp_code} · {formatDate(record.date)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Changed by {entry.by ?? "Unknown"}
                          </p>
                        </div>

                        <p className="text-xs text-slate-500">
                          {formatDateTime(entry.at)}
                        </p>
                      </div>

                      <p className="mt-3 text-sm text-slate-600">
                        Reason: {entry.reason || "No reason provided"}
                      </p>

                      {getChangedFields(entry.changes).length > 0 && (
                        <div className="mt-3 overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="text-slate-500">
                              <tr>
                                <th className="py-2 pr-4">Field</th>
                                <th className="py-2 pr-4">Previous Value</th>
                                <th className="py-2">New Value</th>
                              </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100">
                              {getChangedFields(entry.changes).map(
                                ([field, change]) => (
                                  <tr key={field}>
                                    <td className="py-2 pr-4 font-medium text-slate-700">
                                      {field.replaceAll("_", " ")}
                                    </td>
                                    <td className="py-2 pr-4 text-rose-700">
                                      {change?.from == null
                                        ? "—"
                                        : String(change.from)}
                                    </td>
                                    <td className="py-2 text-emerald-700">
                                      {change?.to == null
                                        ? "—"
                                        : String(change.to)}
                                    </td>
                                  </tr>
                                ),
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </article>
                  ));
                })}
              </div>
            </div>
          )}

        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages} · {total} total records
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => current - 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft size={15} />
              Previous
            </button>

            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => current + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronDown size={15} />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
