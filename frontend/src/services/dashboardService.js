
import { getEmployees } from "./employeeService";
import { getAttendance } from "./attendanceService";

const PRESENT_STATUSES = ["PRESENT", "WFH", "ON_DUTY"];

export async function getDashboardStats() {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });

  const [employeeResponse, attendanceResponse] = await Promise.all([
    getEmployees(1, 100),
    getAttendance({
      date_from: today,
      date_to: today,
      page: 1,
      page_size: 100,
    }),
  ]);

  const employees = Array.isArray(employeeResponse)
    ? employeeResponse
    : employeeResponse?.items ?? [];

  const attendance = Array.isArray(attendanceResponse)
    ? attendanceResponse
    : attendanceResponse?.items ?? [];

  const present = attendance.filter((record) =>
    PRESENT_STATUSES.includes(record.status)
  ).length;

  const absent = attendance.filter(
    (record) => record.status === "ABSENT"
  ).length;

  const leave = attendance.filter(
    (record) => record.status === "LEAVE"
  ).length;

  const attendanceRate =
    employees.length > 0
      ? Number(((present / employees.length) * 100).toFixed(2))
      : 0;

  return {
    totalEmployees: employeeResponse?.total ?? employees.length,
    present,
    absent,
    leave,
    attendanceRate,
    date: today,
  };
}
