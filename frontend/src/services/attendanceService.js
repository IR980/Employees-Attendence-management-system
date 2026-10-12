import api from "./api";

export const getAttendance = async (params = {}) => {
  const response = await api.get("/attendance", { params });
  return response.data;
};

export const punchIn = async (empCode) => {
  const response = await api.post("/attendance/punch-in", {
    emp_code: empCode,
  });
  return response.data;
};

export const punchOut = async (empCode) => {
  const response = await api.post("/attendance/punch-out", {
    emp_code: empCode,
  });
  return response.data;
};