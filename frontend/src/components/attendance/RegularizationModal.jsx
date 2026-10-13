import { useEffect, useState } from "react";
import { X, ClipboardCheck } from "lucide-react";
import { regularizeAttendance } from "../../services/attendanceService";

const STATUSES = ["PRESENT", "ABSENT", "WFH", "ON_DUTY", "LEAVE"];

function toLocalDateTimeInput(value) {
  if (value === null || value === undefined || value === "") return "";

  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return "";

  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function RegularizationModal({ record, onClose, onSuccess }) {
  const [status, setStatus] = useState("PRESENT");
  const [punchIn, setPunchIn] = useState("");
  const [punchOut, setPunchOut] = useState("");
  const [reason, setReason] = useState("");
  const [regularizedBy, setRegularizedBy] = useState("admin");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!record) return;

    setStatus(String(record.status || "PRESENT").toUpperCase());
    setPunchIn(toLocalDateTimeInput(record.punch_in));
    setPunchOut(toLocalDateTimeInput(record.punch_out));
    setReason("");
    setRegularizedBy("admin");
    setError("");
  }, [record]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!reason.trim()) {
      setError("Please enter a reason for the correction.");
      return;
    }

    if (!regularizedBy.trim()) {
      setError("Please enter the admin identifier.");
      return;
    }

    if (punchIn && punchOut && new Date(punchOut) < new Date(punchIn)) {
      setError("Punch Out cannot be earlier than Punch In.");
      return;
    }

    const correction = {
      status,
      reason: reason.trim(),
      regularized_by: regularizedBy.trim(),
    };

    // Send timestamps only when the corresponding field has a value.
    // Never send 0 as a timestamp.
    if (punchIn) correction.punch_in = new Date(punchIn).getTime();
    if (punchOut) correction.punch_out = new Date(punchOut).getTime();

    try {
      setSaving(true);
      setError("");

      await regularizeAttendance(record.emp_code, record.date, correction);

      await onSuccess?.();
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          "Unable to correct this attendance record.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!record) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="regularization-title"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
              <ClipboardCheck size={22} />
            </div>
            <div>
              <h2
                id="regularization-title"
                className="text-lg font-bold text-slate-900"
              >
                Regularize Attendance
              </h2>
              <p className="text-sm text-slate-500">
                Correct the selected attendance record.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close modal"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Employee Code
              <input
                value={record.emp_code || ""}
                readOnly
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Attendance Date
              <input
                value={record.date || ""}
                readOnly
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Status
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              >
                {STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {item.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Regularized By
              <input
                value={regularizedBy}
                onChange={(event) => setRegularizedBy(event.target.value)}
                required
                placeholder="Admin identifier"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Punch In
              <input
                type="datetime-local"
                value={punchIn}
                onChange={(event) => setPunchIn(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Leave unchanged if no correction is needed.
              </span>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Punch Out
              <input
                type="datetime-local"
                value={punchOut}
                onChange={(event) => setPunchOut(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Leave unchanged if no correction is needed.
              </span>
            </label>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Reason for Correction
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              minLength={3}
              rows={3}
              placeholder="Explain why this attendance record needs correction..."
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </label>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
            >
              {typeof error === "string" ? error : JSON.stringify(error)}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Correction"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
