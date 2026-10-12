import { useMemo, useState } from "react";

function employeeCode(employee) {
  return employee.emp_code || employee.employee_code || employee.code || employee._id;
}

export default function EmployeeTable({ employees, loading, error, onRetry }) {
  const [query, setQuery] = useState("");

  const filteredEmployees = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return employees;
    return employees.filter((employee) =>
      [
        employee.name,
        employeeCode(employee),
        employee.department,
        employee.email,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized))
    );
  }, [employees, query]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-6">
        <div>
          <h3 className="font-bold">Employees</h3>
          <p className="mt-1 text-sm text-slate-500">
            Employee records loaded from FastAPI
          </p>
        </div>
        <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
          {loading ? "Loading…" : `${filteredEmployees.length} records`}
        </span>
      </div>

      <div className="border-b border-slate-100 p-4">
        <input
          id="employee-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, employee code, or department..."
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
        />
      </div>

      {loading && <p className="p-6 text-sm text-slate-500">Loading employees…</p>}

      {error && (
        <div className="m-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          <p className="font-semibold">Unable to load employees</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-162.5 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-6 py-4 font-semibold">Employee</th>
                <th className="px-6 py-4 font-semibold">Department</th>
                <th className="px-6 py-4 font-semibold">Shift Start</th>
                <th className="px-6 py-4 font-semibold">Record Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-slate-500">
                    {employees.length
                      ? "No employees match your search."
                      : "No employees found. Add an employee through the API first."}
                  </td>
                </tr>
              )}
              {filteredEmployees.map((employee, index) => {
                const code = employeeCode(employee) || `employee-${index}`;
                return (
                  <tr key={String(code)} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <p className="font-semibold">{employee.name || "Unnamed employee"}</p>
                      <p className="mt-1 text-xs text-slate-500">{code}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {employee.department || "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {employee.shift_start || employee.shiftStart || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        Registered
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
