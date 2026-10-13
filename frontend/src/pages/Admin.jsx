import { useState } from "react";
import { Activity, Search, Database, Clock3, FileSearch } from "lucide-react";
import api from "../services/api";
import Topbar from "../components/layout/Topbar";

const ENDPOINTS = [
  { value: "attendance_list", label: "Attendance List" },
  { value: "employee_monthly", label: "Employee Monthly Analytics" },
  { value: "department_summary", label: "Department Summary" },
  { value: "late_leaderboard", label: "Late Arrival Leaderboard" },
  { value: "department_trend", label: "Department Trend" },
];

export default function Admin() {
  const [endpoint, setEndpoint] = useState("attendance_list");
  const [filters, setFilters] = useState({
    emp_code: "EMP0001",
    month: "2026-10",
    department: "Engineering",
    limit: "10",
    date_from: "",
    date_to: "",
    page: "1",
    page_size: "20",
    from: "2026-10-01",
    to: "2026-10-13",
    status: "",
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateFilter(event) {
    setFilters((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function runExplain(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    const allowed = {
      attendance_list: [
        "emp_code",
        "date_from",
        "date_to",
        "status",
        "page",
        "page_size",
      ],
      employee_monthly: ["emp_code", "month"],
      department_summary: ["month", "department"],
      late_leaderboard: ["month", "limit"],
      department_trend: ["department", "from", "to"],
    };

    const params = {};
    for (const key of allowed[endpoint]) {
      if (filters[key] !== "") params[key] = filters[key];
    }

    try {
      const response = await api.get(`/admin/explain/${endpoint}`, { params });
      setResult(response.data);
    } catch (err) {
      setError(
        typeof err.response?.data?.detail === "string"
          ? err.response.data.detail
          : JSON.stringify(err.response?.data?.detail ?? err.message),
      );
    } finally {
      setLoading(false);
    }
  }

  const explain = result?.explain;
  const stats = explain?.executionStats;
  const plan = explain?.queryPlanner?.winningPlan;
  const planText = JSON.stringify(plan ?? {});
  const usesIndex = /IXSCAN/.test(planText);
  const hasCollectionScan = /COLLSCAN/.test(planText);

  const fieldsByEndpoint = {
    attendance_list: [
      "emp_code",
      "date_from",
      "date_to",
      "status",
      "page",
      "page_size",
    ],
    employee_monthly: ["emp_code", "month"],
    department_summary: ["month", "department"],
    late_leaderboard: ["month", "limit"],
    department_trend: ["department", "from", "to"],
  };

  const labels = {
    emp_code: "Employee Code",
    month: "Month (YYYY-MM)",
    department: "Department",
    limit: "Result Limit",
    date_from: "Date From",
    date_to: "Date To",
    page: "Page",
    page_size: "Page Size",
    from: "Trend From",
    to: "Trend To",
    status: "Attendance Status",
  };

  return (
    <main className="min-w-0 flex-1 p-5 md:p-8">
      <Topbar />

      <section className="mb-7 mt-5">
        <p className="text-sm text-slate-500">Workspace / Admin</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          Admin Diagnostics
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Inspect MongoDB query plans and execution statistics.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-bold text-slate-900">Explain Endpoint</h2>

        <form onSubmit={runExplain} className="space-y-5">
          <label className="block text-sm font-medium text-slate-700">
            API Endpoint
            <select
              value={endpoint}
              onChange={(event) => {
                setEndpoint(event.target.value);
                setResult(null);
                setError("");
              }}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3"
            >
              {ENDPOINTS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fieldsByEndpoint[endpoint].map((key) => (
              <label key={key} className="text-sm font-medium text-slate-700">
                {labels[key]}
                {key === "status" ? (
                  <select
                    name={key}
                    value={filters[key]}
                    onChange={updateFilter}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                  >
                    <option value="">All statuses</option>
                    {["PRESENT", "ABSENT", "LEAVE", "WFH", "ON_DUTY"].map(
                      (value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ),
                    )}
                  </select>
                ) : (
                  <input
                    name={key}
                    type={
                      ["date_from", "date_to", "from", "to"].includes(key)
                        ? "date"
                        : "text"
                    }
                    value={filters[key]}
                    onChange={updateFilter}
                    placeholder={labels[key]}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                  />
                )}
              </label>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <Search size={17} />
            {loading ? "Inspecting..." : "Run Explain"}
          </button>
        </form>
      </section>

      {error && (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          {error}
        </div>
      )}

      {result && (
        <>
          <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Execution Time",
                value: `${stats?.executionTimeMillis ?? "—"} ms`,
                icon: Clock3,
              },
              {
                label: "Documents Examined",
                value: stats?.totalDocsExamined ?? "—",
                icon: FileSearch,
              },
              {
                label: "Keys Examined",
                value: stats?.totalKeysExamined ?? "—",
                icon: Database,
              },
              {
                label: "Documents Returned",
                value: stats?.nReturned ?? "—",
                icon: Activity,
              },
            ].map((item) => (
              <article
                key={item.label}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <item.icon size={20} className="text-blue-600" />
                <p className="mt-3 text-sm text-slate-500">{item.label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {item.value}
                </p>
              </article>
            ))}
          </section>

          <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-bold text-slate-900">Query Plan Status</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${usesIndex ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
              >
                {usesIndex ? "Index scan detected" : "Index scan not detected"}
              </span>
              <span
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${hasCollectionScan ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}
              >
                {hasCollectionScan
                  ? "Collection scan detected"
                  : "No collection scan in winning plan"}
              </span>
            </div>

            <p className="mt-3 text-sm text-slate-500">
              Collection: {result.collection ?? "—"}
            </p>
          </section>

          <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <h2 className="font-bold text-slate-900">Raw Explain Response</h2>
              <button
                type="button"
                onClick={() =>
                  navigator.clipboard.writeText(JSON.stringify(result, null, 2))
                }
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Copy JSON
              </button>
            </div>
            <pre className="max-h-150 overflow-auto bg-slate-950 p-5 text-xs leading-6 text-emerald-300">
              {JSON.stringify(result, null, 2)}
            </pre>
          </section>
        </>
      )}
    </main>
  );
}
