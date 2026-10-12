import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  BarChart3,
  Settings,
  Building2,
  UserRoundSearch,
} from "lucide-react";

const navigation = [
  {
    label: "Dashboard",
    path: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Employees",
    path: "/employees",
    icon: Users,
  },
  {
    label: "Attendance",
    path: "/attendance",
    icon: CalendarCheck,
  },
  {
    label: "Analytics",
    path: "/analytics",
    icon: BarChart3,
    end: true,
  },
  {
    label: "Employee Analytics",
    path: "/analytics/employee",
    icon: UserRoundSearch,
  },
];

export default function Sidebar() {
  return (
    <aside className="flex min-h-screen w-full shrink-0 flex-col border-r border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-64">
      <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
          <Building2 size={23} />
        </div>

        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            HROne
          </h1>
          <p className="text-xs text-slate-500">Attendance & Analytics</p>
        </div>
      </div>

      <div className="px-4 pt-6">
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Main Menu
        </p>

        <nav className="space-y-1">
          {navigation.map(({ label, path, icon: Icon, end }) => (
            <NavLink
              key={path}
              to={path}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`
              }
            >
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-4">
        <div className="rounded-xl bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-slate-700">
            <Settings size={17} />
            <span className="text-sm font-semibold">Workspace</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Employee management portal
          </p>
        </div>
      </div>
    </aside>
  );
}
