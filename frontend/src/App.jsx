import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Sidebar from "./components/layout/Sidebar";

import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Attendance from "./pages/Attendance";
import Analytics from "./pages/Analytics";
import EmployeeAnalytics from "./pages/EmployeeAnalytics";
import EmployeeDetails from "./pages/EmployeeDetails";
import AddEmployee from "./pages/AddEmployee";
import Admin from "./pages/Admin";
export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 md:flex">
        <Sidebar />

        <Routes>
          <Route path="/" element={<Dashboard />} />

          <Route path="/employees" element={<Employees />} />

          <Route path="/employees/new" element = {<AddEmployee/>} />

          <Route path="/employees/:empCode" element={<EmployeeDetails />} />

          <Route path="/attendance" element={<Attendance />} />

          <Route path="/analytics" element={<Analytics />} />

          <Route
            path="/analytics/employee"
            element={<EmployeeAnalytics />}
          />

          <Route path="/admin" element = {<Admin/>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
