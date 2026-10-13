
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Clock3,
  ChartNoAxesCombined,
  Users,
  UserPlus,
} from "lucide-react";

export default function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    {
        title: "Create New Employees",
        description: "Register a new employee",
        icon: UserPlus,
        path: "/employees/new",
        primary: true
    },
    {
      title: "View Employees",
      description: "Open employee directory",
      icon: Users,
      path: "/employees",
    },
    {
      title: "Attendance",
      description: "View attendance and punch actions",
      icon: Clock3,
      path: "/attendance",
    },
    {
      title: "View Analytics",
      description: "Explore attendance reports",
      icon: ChartNoAxesCombined,
      path: "/analytics",
    },
  ];

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="font-bold text-slate-900">Quick Actions</h3>

      <p className="mt-1 text-sm text-slate-500">
        Common employee and attendance tasks
      </p>

      <div className="mt-5 space-y-3">
        {actions.map(({ title, description, icon: Icon, path, primary }) => (
          <button
            key={path}
            type="button"
            onClick={() => navigate(path)}
            className={`flex w-full items-center justify-between rounded-xl p-4 text-left transition ${
              primary
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "border border-slate-200 text-slate-800 hover:bg-slate-50"
            }`}
          >
            <span>
              <span className="block text-sm font-semibold">{title}</span>
              <span
                className={`mt-1 block text-xs ${
                  primary ? "text-blue-100" : "text-slate-500"
                }`}
              >
                {description}
              </span>
            </span>

            <span className="flex items-center gap-2">
              <Icon size={19} />
              <ArrowUpRight size={16} />
            </span>
          </button>
        ))}
      </div>
    </article>
  );
}
