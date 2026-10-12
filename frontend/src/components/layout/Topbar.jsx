import { Search, Bell } from "lucide-react";

export default function Topbar() {
  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-sm text-slate-500">Workspace / Overview</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
          Attendance Dashboard
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Monitor employee records and workforce activity.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Search employees"
          onClick={() => document.getElementById("employee-search")?.focus()}
          className="rounded-xl border border-slate-200 bg-white p-3 text-slate-600 hover:bg-slate-100"
        >
          <Search size={19} />
        </button>
        <button
          type="button"
          aria-label="Notifications"
          onClick={() => alert("No new notifications.")}
          className="rounded-xl border border-slate-200 bg-white p-3 text-slate-600 hover:bg-slate-100"
        >
          <Bell size={19} />
        </button>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2 pr-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
            A
          </div>
          <div>
            <p className="text-sm font-semibold">Admin</p>
            <p className="text-xs text-slate-500">Administrator</p>
          </div>
        </div>
      </div>
    </header>
  );
}
