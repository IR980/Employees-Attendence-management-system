# Employee Attendance & Analytics API

FastAPI + MongoDB implementation for the HROne Software Engineer Trainee assignment (contract v2.0).

## Requirements
- Python 3.11+
- MongoDB 6.0+ (MongoDB 7.0 recommended)
- Git

## Setup (Windows PowerShell)
```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
$env:MONGO_URI = "mongodb atlas url"
$env:MONGO_DB = "attendance_db"
uvicorn app.main:app --port 8000 --reload
```

## Setup (macOS/Linux)
```bash
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
export MONGO_URI="mongodb://localhost:27017"
export MONGO_DB="attendance_db"
uvicorn app.main:app --port 8000 --reload
```

A local `.env` file is supported for development, but do not commit it. Real environment variables take precedence.
The application creates indexes on startup. `/health` returns 200 only when MongoDB responds to `ping`.

## API docs
When running locally:
- Swagger UI: http://127.0.0.1:8000/docs
- OpenAPI JSON: http://127.0.0.1:8000/openapi.json

## Contract implementation
Endpoints implemented:
- `GET /health`
- `POST /employees`, `GET /employees`
- `POST /attendance/punch-in`, `POST /attendance/punch-out`
- `GET /attendance`, `PATCH /attendance/{emp_code}/{date}`
- `GET /analytics/employees/{emp_code}/monthly`
- `GET /analytics/departments/summary`
- `GET /analytics/leaderboard/late`
- `GET /analytics/departments/{department}/trend`
- `GET /admin/explain/{endpoint}`

## Important implementation notes
- `emp_code` is the public employee identifier; MongoDB `_id` is never returned.
- API timestamps are epoch milliseconds; persisted instants are UTC BSON dates.
- Analytics aggregate stored derived values instead of recalculating them.
- The unique `(emp_code, date)` index is the race-safe guard for duplicate punch-ins.
- Read `DECISIONS.md` and verify each design choice before using this as your submission.

## Before submitting
1. Run against MongoDB 7.0 and exercise every endpoint.
2. Add tests for concurrent requests, overnight shifts, exact 10-minute grace boundary, overtime at 29/30 minutes, half-day rounding, joiners, weekends, no-log employees, ties, and empty days.
3. Inspect every explain plan. The contract expects `IXSCAN` and no `COLLSCAN` for the grader's workload.
4. Ensure you can explain and modify every line. This assignment explicitly includes a live code walkthrough.
5. Submit only required source/documentation files. Do not publish the assignment prompt, hidden data, `.env`, secrets, Dockerfile, or virtual environment.

# Employee Attendance & Analytics System

A full-stack employee attendance management system built with **FastAPI**, **MongoDB**, and **React**. It supports employee records, punch-in/punch-out, attendance regularization with audit history, and analytics for employees and departments.

> **Project status:** The backend API and analytics endpoints are implemented. The Admin Explain endpoint provides MongoDB query-plan diagnostics. Admin login/JWT authentication should be implemented and verified before exposing protected functionality publicly.

## Features

- **Employee management:** Create and list employees with pagination and department filtering.
- **Attendance tracking:** Punch in/out; track `PRESENT`, `WFH`, `ON_DUTY`, `ABSENT`, and `LEAVE`.
- **Calculated metrics:** Work hours, late minutes, overtime, and half-day status.
- **Attendance regularization:** Correct existing records and retain change history, reason, editor identifier, and timestamp.
- **Analytics:** Monthly employee summaries, department summaries and trends, and a late-arrival leaderboard.
- **Database diagnostics:** Inspect MongoDB query plans through `/admin/explain/{endpoint}`.
- **React frontend:** Dashboard, employees, attendance, and analytics pages, depending on the current frontend implementation.

## Technology Stack

**Backend:** Python 3.11+, FastAPI, PyMongo, MongoDB, Pydantic, Uvicorn  
**Frontend:** React, Vite, Tailwind CSS, Axios, React Router, Recharts, Lucide React

## Project Structure

```text
hrone_attendance_solution/
├── app/
│   └── main.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── services/
│   ├── .env
│   └── package.json
├── .env                  # Backend environment variables; do not commit
├── requirements.txt
├── README.md
├── REVIEW.md
└── DECISIONS.md
```

Your local files may differ slightly from this outline.

## Prerequisites

- Python 3.11 or newer
- Node.js and npm
- MongoDB Atlas account or a locally running MongoDB server

## Backend Setup

### 1. Open the project directory

```powershell
cd D:\hrone_attendance_solution\hrone_attendance_solution
```

### 2. Create and activate a virtual environment (recommended)

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

If PowerShell blocks activation, use Command Prompt:

```bat
.venv\Scripts\activate.bat
```

### 3. Install dependencies

```powershell
pip install -r requirements.txt
```

If `requirements.txt` is incomplete, ensure it includes the packages used by your backend, such as:

```text
fastapi
uvicorn[standard]
pymongo
python-dotenv
pydantic
```

Add authentication dependencies to `requirements.txt` if JWT authentication is added to your version.

### 4. Configure environment variables

Create a `.env` file in the project root:

```dotenv
MONGO_URI=mongodb+srv://<username>:<password>@<cluster-url>/<database>?retryWrites=true&w=majority
MONGO_DB=attendance_db
```

Replace placeholders with your own MongoDB Atlas connection details. For local MongoDB, you can use `mongodb://localhost:27017`.

**Security:** Never commit `.env` or real credentials. Add `.env`, `.venv/`, `__pycache__/`, and `node_modules/` to `.gitignore`. Rotate any database credentials that have been exposed.

### 5. Start the backend

From the project root:

```powershell
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://127.0.0.1:8000`.

- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`
- Health check: `http://127.0.0.1:8000/health`

The health endpoint checks MongoDB connectivity and returns HTTP `503` if the database is unavailable.

## Frontend Setup

Open a second terminal:

```powershell
cd D:\hrone_attendance_solution\hrone_attendance_solution\frontend
npm install
```

Create `frontend/.env`:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Start Vite:

```powershell
npm run dev
```

Open the local URL printed by Vite, typically `http://localhost:5173`.

The current backend CORS configuration permits `http://localhost:5173` and `http://127.0.0.1:5173`. Update the allowlist deliberately if your frontend uses a different origin. Restart Vite after changing its `.env`.

## API Reference

### System

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Check API and MongoDB readiness |

### Employees

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/employees` | Create an employee |
| `GET` | `/employees` | List employees; supports `department`, `page`, and `page_size` |

Example employee payload:

```json
{
  "emp_code": "EMP0001",
  "name": "Example Employee",
  "email": "employee@example.com",
  "department": "Engineering",
  "shift_start": "09:30",
  "shift_end": "18:30",
  "joined_on": "2026-01-15"
}
```

### Attendance

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/attendance/punch-in` | Record punch-in |
| `POST` | `/attendance/punch-out` | Record punch-out |
| `GET` | `/attendance` | List attendance with filters and pagination |
| `PATCH` | `/attendance/{emp_code}/{date}` | Regularize an existing attendance record |

Attendance list filters include `emp_code`, `date_from`, `date_to`, and `status`. Pagination uses `page` and `page_size` (maximum 100).

Example punch-in payload:

```json
{
  "emp_code": "EMP0001",
  "status": "PRESENT"
}
```

For a manual timestamp, `punched_at` must be an integer Unix epoch timestamp in **milliseconds**.

Example regularization payload:

```json
{
  "status": "PRESENT",
  "reason": "Corrected after manager review",
  "regularized_by": "admin@example.com"
}
```

Include `punch_in` and/or `punch_out` as epoch-millisecond values when changing punch times. The record must already exist. `ABSENT` and `LEAVE` records cannot have punch times.

### Analytics

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/analytics/employees/{emp_code}/monthly?month=YYYY-MM` | Monthly employee summary |
| `GET` | `/analytics/departments/summary?month=YYYY-MM` | Department summary |
| `GET` | `/analytics/leaderboard/late?month=YYYY-MM&limit=10` | Late-arrival leaderboard |
| `GET` | `/analytics/departments/{department}/trend?from=YYYY-MM-DD&to=YYYY-MM-DD` | Department attendance trend (maximum 92 days) |

### MongoDB Explain Diagnostics

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/admin/explain/{endpoint}` | Return MongoDB aggregation execution-plan diagnostics |

Supported endpoint values:

- `attendance_list`
- `employee_monthly`
- `department_summary`
- `late_leaderboard`
- `department_trend`

This diagnostics endpoint is **not** an authentication mechanism. Restrict it before deploying the API publicly.

## Data and Calculation Notes

- API timestamps are Unix epoch milliseconds.
- Shift times use 24-hour `HH:MM` format.
- Attendance dates use `YYYY-MM-DD`.
- Shift-related date calculations use India Standard Time (IST, UTC+05:30).
- `PRESENT`, `WFH`, and `ON_DUTY` count as presence statuses.
- `ABSENT` and `LEAVE` do not count as present.
- Missing attendance records are distinct from explicit `ABSENT` records.
- Monthly working days are calculated from weekdays and the employee's join date; public holidays are not automatically excluded unless separately implemented.

## Troubleshooting

### MongoDB connection fails
- Verify `MONGO_URI` and `MONGO_DB` in the root `.env`.
- Confirm your Atlas IP access list permits your current IP.
- Check the database username/password and URL-encode special characters if necessary.
- Ensure your local MongoDB service is running if using a local URI.

### Frontend cannot reach the API
- Confirm the backend is running on port `8000`.
- Confirm `frontend/.env` contains `VITE_API_BASE_URL=http://127.0.0.1:8000`.
- Restart Vite after editing `.env`.
- Confirm the frontend origin is in the backend CORS allowlist.

### API returns `404`, `409`, or `422`
- `404`: the employee or attendance record may not exist.
- `409`: a duplicate employee/attendance record or conflicting update may exist.
- `422`: check required fields, date/time formats, status values, and timestamp units.

## Security and Deployment Checklist

Before deploying publicly:

- [ ] Protect employee creation and attendance correction endpoints with authentication and authorization.
- [ ] Protect `/admin/explain/{endpoint}`; query-plan output should not be public.
- [ ] Use controlled admin provisioning; do not allow unrestricted public admin signup.
- [ ] Store password hashes, never plain-text passwords.
- [ ] Use HTTPS and strong token-signing secrets.
- [ ] Keep secrets in deployment environment variables, not source control.
- [ ] Configure production CORS origins explicitly.
- [ ] Avoid logging credentials or sensitive employee data.

## License

No license has been specified. Add a `LICENSE` file before distributing or reusing this project.

