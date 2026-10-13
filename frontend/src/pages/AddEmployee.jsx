import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  UserPlus,
  Save,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import Topbar from "../components/layout/Topbar";
import { createEmployee } from "../services/employeeService";

const initialForm = {
  emp_code: "",
  name: "",
  email: "",
  department: "",
  shift_start: "09:30",
  shift_end: "18:30",
  joined_on: new Date().toISOString().slice(0, 10),
};

const departments = [
  "Engineering",
  "Sales",
  "Human Resources",
  "Finance",
  "Marketing",
  "Operations",
  "Support",
  "Other",
];

export default function AddEmployee() {
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const payload = {
      emp_code: form.emp_code.trim(),
      name: form.name.trim(),
      email: form.email.trim(),
      department: form.department.trim(),
      shift_start: form.shift_start,
      shift_end: form.shift_end,
      joined_on: form.joined_on,
    };

    if (
      !payload.emp_code ||
      !payload.name ||
      !payload.email ||
      !payload.department ||
      !payload.shift_start ||
      !payload.shift_end ||
      !payload.joined_on
    ) {
      setError("Please fill in all required fields.");
      return;
    }

    try {
      setLoading(true);

      const createdEmployee = await createEmployee(payload);

      setSuccess(
        `Employee ${createdEmployee?.emp_code ?? payload.emp_code} created successfully.`,
      );

      setForm(initialForm);

      // Employee list open karein after successful creation.
      // Success message is briefly shown before navigation.
      navigate("/employees", {
        state: {
          success: `Employee ${createdEmployee?.emp_code ?? payload.emp_code} created successfully.`,
        },
      });
    } catch (err) {
      const detail = err.response?.data?.detail;

      setError(
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.map((item) => item.msg).join(", ")
            : err.response?.status === 409
              ? "This employee code or email may already exist."
              : (err.message ?? "Unable to create employee."),
      );
    } finally {
      setLoading(false);
    }
  }

  const fields = [
    {
      name: "emp_code",
      label: "Employee Code",
      placeholder: "e.g. EMP0004",
      type: "text",
    },
    {
      name: "name",
      label: "Full Name",
      placeholder: "Enter employee full name",
      type: "text",
    },
    {
      name: "email",
      label: "Email Address",
      placeholder: "employee@example.com",
      type: "email",
    },
    {
      name: "joined_on",
      label: "Joining Date",
      type: "date",
    },
    {
      name: "shift_start",
      label: "Shift Start",
      type: "time",
    },
    {
      name: "shift_end",
      label: "Shift End",
      type: "time",
    },
  ];

  return (
    <main className="min-w-0 flex-1 bg-slate-50 p-5 md:p-8">
      <Topbar />

      <section className="mb-7 mt-5">
        <button
          type="button"
          onClick={() => navigate("/employees")}
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-700"
        >
          <ArrowLeft size={17} />
          Back to Employees
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
            <UserPlus size={24} />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
              Add Employee
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Register a new employee in your organization.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="font-bold text-slate-900">Employee Information</h2>
          <p className="mt-1 text-sm text-slate-500">
            Fields marked with * are required.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2">
            {fields.slice(0, 3).map((field) => (
              <div key={field.name}>
                <label
                  htmlFor={field.name}
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  {field.label} *
                </label>

                <input
                  id={field.name}
                  name={field.name}
                  type={field.type}
                  value={form[field.name]}
                  onChange={handleChange}
                  placeholder={field.placeholder}
                  required
                  maxLength={field.name === "emp_code" ? 50 : 150}
                  autoComplete={
                    field.name === "email"
                      ? "email"
                      : field.name === "name"
                        ? "name"
                        : "off"
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            ))}

            <div>
              <label
                htmlFor="department"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Department *
              </label>

              <select
                id="department"
                name="department"
                value={form.department}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Select department</option>

                {departments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>

              {form.department === "Other" && (
                <p className="mt-2 text-xs text-amber-700">
                  If your backend expects a specific department name, choose or
                  enter the supported value.
                </p>
              )}
            </div>

            {fields.slice(3).map((field) => (
              <div key={field.name}>
                <label
                  htmlFor={field.name}
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  {field.label} *
                </label>

                <input
                  id={field.name}
                  name={field.name}
                  type={field.type}
                  value={form[field.name]}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            ))}
          </div>

          {error && (
            <div
              role="alert"
              className="mx-6 mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div
              role="status"
              className="mx-6 mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
            >
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              <p>{success}</p>
            </div>
          )}

          <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-5 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate("/employees")}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={17} />
              {loading ? "Saving Employee..." : "Create Employee"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
