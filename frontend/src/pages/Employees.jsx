import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  Users,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/layout/Topbar";
import { getEmployees } from "../services/employeeService";

const PAGE_SIZE = 20;

function getItems(response) {
  if (Array.isArray(response)) return response;
  return response?.items ?? response?.employees ?? response?.data ?? [];
}

function getEmployeeName(employee) {
  return (
    employee.name ??
    employee.full_name ??
    employee.employee_name ??
    employee.emp_name ??
    "Unnamed Employee"
  );
}

function getEmployeeCode(employee) {
  return employee.emp_code ?? employee.employee_id ?? employee._id ?? "";
}

export default function Employees() {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [department, setDepartment] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getEmployees(page, PAGE_SIZE, department);
      const items = getItems(response);

      setEmployees(items);
      setTotal(
        typeof response?.total === "number" ? response.total : items.length,
      );
    } catch (err) {
      setError(
        err.response?.data?.detail ??
          err.message ??
          "Unable to load employees. Please check the backend.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, department]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  const departments = useMemo(() => {
    return [
      ...new Set(
        employees.map((employee) => employee.department).filter(Boolean),
      ),
    ].sort();
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return employees;

    return employees.filter((employee) => {
      const values = [
        getEmployeeName(employee),
        employee.emp_code,
        employee.employee_id,
        employee.email,
        employee.department,
        employee.designation,
        employee.role,
      ];

      return values.some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(query),
      );
    });
  }, [employees, search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleDepartmentChange(event) {
    setDepartment(event.target.value);
    setPage(1);
  }

  function openEmployeeDetails(employee) {
    const code = getEmployeeCode(employee);

    if (!code) {
      setError("This employee does not have a valid employee identifier.");
      return;
    }

    navigate(`/employees/${encodeURIComponent(String(code))}`);
  }

  return (
    <main className="min-w-0 flex-1 bg-slate-50 p-5 md:p-8">
      <Topbar />

      <section className="mb-7 mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Workspace</span>
            <span>/</span>
            <span className="font-medium text-blue-600">Employees</span>
          </div>

          <h2 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">
            Employees
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            View and manage your organization's employee directory.
          </p>
        </div>

        <button
          type="button"
          onClick={loadEmployees}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Total Employees
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {loading ? "…" : total}
              </p>
            </div>

            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <Users size={23} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Employees on This Page
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {loading ? "…" : employees.length}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Employee Directory</h3>
            <p className="mt-1 text-sm text-slate-500">
              Search employees or filter by department.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search this page..."
                aria-label="Search employees on this page"
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-64"
              />
            </div>

            <select
              value={department}
              onChange={handleDepartmentChange}
              aria-label="Filter by department"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            >
              <option value="">All Departments</option>
              {departments.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="m-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
          >
            <p>{error}</p>
            <button
              type="button"
              onClick={loadEmployees}
              className="mt-2 font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-225 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Employee</th>
                <th className="px-5 py-4 font-semibold">Employee Code</th>
                <th className="px-5 py-4 font-semibold">Department</th>
                <th className="px-5 py-4 font-semibold">Designation</th>
                <th className="px-5 py-4 font-semibold">Email</th>
                <th className="px-5 py-4 font-semibold">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-slate-500"
                  >
                    Loading employees...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-slate-500"
                  >
                    Employee data could not be loaded.
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-slate-500"
                  >
                    No employees found. Try another search or department.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee, index) => {
                  const name = getEmployeeName(employee);
                  const code = getEmployeeCode(employee) || "—";

                  return (
                    <tr
                      key={employee._id ?? employee.emp_code ?? index}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 font-bold text-blue-700">
                            {String(name).charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-800">
                            {name}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 font-medium text-slate-700">
                        {code}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {employee.department ?? "—"}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {employee.designation ?? employee.role ?? "—"}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {employee.email ?? "—"}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => openEmployeeDetails(employee)}
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                        >
                          <Eye size={14} />
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages} · {total} total employees
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => current - 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => current + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
