import { ArrowUpRight, Clock3, ChartNoAxesCombined } from "lucide-react";

export default function QuickActions() {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="font-bold">Quick Actions</h3>
      <p className="mt-1 text-sm text-slate-500">Common employee and attendance tasks</p>
      <div className="mt-5 space-y-3">
        <button
          type="button"
          onClick={() => alert("Employee creation form will be added next.")}
          className="flex w-full items-center justify-between rounded-xl bg-blue-600 p-4 text-left text-white hover:bg-blue-700"
        >
          <span>
            <span className="block text-sm font-semibold">Add Employee</span>
            <span className="mt-1 block text-xs text-blue-100">Register a new employee</span>
          </span>
          <ArrowUpRight size={20} />
        </button>
        <button
          type="button"
          onClick={() => alert("Punch-In form will be added next.")}
          className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-4 text-left hover:bg-slate-50"
        >
          <span>
            <span className="block text-sm font-semibold">Punch-In</span>
            <span className="mt-1 block text-xs text-slate-500">Record arrival time</span>
          </span>
          <Clock3 size={20} />
        </button>
        <button
          type="button"
          onClick={() => alert("Analytics page will be added next.")}
          className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-4 text-left hover:bg-slate-50"
        >
          <span>
            <span className="block text-sm font-semibold">View Analytics</span>
            <span className="mt-1 block text-xs text-slate-500">Explore attendance reports</span>
          </span>
          <ChartNoAxesCombined size={20} />
        </button>
      </div>
    </article>
  );
}
