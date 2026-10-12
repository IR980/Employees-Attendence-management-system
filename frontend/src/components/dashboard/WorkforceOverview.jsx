import { RefreshCw } from "lucide-react";

export default function WorkforceOverview({ totalEmployees, loading, onRefresh }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 xl:col-span-2">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">Workforce Overview</h3>
          <p className="mt-1 text-sm text-slate-500">
            Live employee count from your API
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>
      <div className="rounded-xl bg-blue-50 p-5">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-medium text-blue-800">Registered employees</span>
          <span className="font-bold text-blue-900">
            {loading ? "…" : totalEmployees}
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-blue-100">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: totalEmployees > 0 ? "100%" : "0%" }}
          />
        </div>
        <p className="mt-3 text-xs text-blue-700">
          Attendance statistics will be connected to the attendance API next.
        </p>
      </div>
    </article>
  );
}
