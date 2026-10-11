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
$env:MONGO_URI = "mongodb://localhost:27017"
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
