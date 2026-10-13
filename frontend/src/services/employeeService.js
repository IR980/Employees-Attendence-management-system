
import api from "./api";

export const getEmployees = async (
  page = 1,
  pageSize = 20,
  department = ""
) => {
  const params = {
    page,
    page_size: pageSize,
  };

  if (department && department !== "All Departments") {
    params.department = department;
  }

  const response = await api.get("/employees", { params });
  return response.data;
};

export const createEmployee = async (employeeData) => {
  const response = await api.post("/employees", employeeData);
  return response.data;
};
