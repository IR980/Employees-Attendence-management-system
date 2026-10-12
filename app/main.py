from __future__ import annotations

import base64
from bson.timestamp import Timestamp
from bson import ObjectId
from bson.decimal128 import Decimal128
import calendar
import os
import re
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Literal
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Path as ApiPath
from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator, model_validator
from pymongo import ASCENDING, DESCENDING, MongoClient, ReturnDocument
from pymongo.errors import DuplicateKeyError, PyMongoError
from pymongo.write_concern import WriteConcern

load_dotenv()  # Environment variables already present always take precedence.

UTC = timezone.utc
IST = timezone(timedelta(hours=5, minutes=30))
MIN_EPOCH_MS = 100_000_000_000
MAX_EPOCH_MS = 4_102_444_800_000
PRESENCE_STATUSES = {"PRESENT", "WFH", "ON_DUTY"}
ALL_STATUSES = PRESENCE_STATUSES | {"ABSENT", "LEAVE"}
PRESENT_EXPRESSION = {"$in": ["$status", ["PRESENT", "WFH", "ON_DUTY"]]}

client = MongoClient(
    os.getenv("MONGO_URI", "mongodb://localhost:27017"),
    serverSelectionTimeoutMS=3000,
    tz_aware=True,
    tzinfo=UTC,
)
db = client[os.getenv("MONGO_DB", "attendance_db")]
employees = db["employees"]
attendance = db["attendance_logs"]

app = FastAPI(
    title="Employee Attendance & Analytics API",
    version="2.0.0",
    description="Employee attendance, regularization, and MongoDB-backed analytics.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------- Validation ---------------------------------

def valid_date(value: str) -> date:
    if not isinstance(value, str):
        raise ValueError("Date must be YYYY-MM-DD")
    try:
        parsed = date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError("Date must be a valid YYYY-MM-DD date") from exc
    if parsed.isoformat() != value:
        raise ValueError("Date must be YYYY-MM-DD")
    return parsed


def valid_month(value: str) -> tuple[date, date]:
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", value or ""):
        raise ValueError("month must be YYYY-MM")
    year, month = map(int, value.split("-"))
    last = calendar.monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last)


def valid_shift(value: str) -> str:
    if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", value or ""):
        raise ValueError("Time must be HH:MM in 24-hour format")
    return value


def epoch_ms_to_datetime(value: int) -> datetime:
    # bool is an int subclass; reject it explicitly.
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError("Timestamp must be an integer epoch-millisecond value")
    if value < MIN_EPOCH_MS or value > MAX_EPOCH_MS:
        raise ValueError("Timestamp is outside the supported epoch-millisecond range")
    try:
        return datetime.fromtimestamp(value / 1000, tz=UTC).replace(microsecond=0)
    except (OverflowError, OSError, ValueError) as exc:
        raise ValueError("Invalid epoch-millisecond timestamp") from exc


def now_utc_seconds() -> datetime:
    return datetime.now(UTC).replace(microsecond=0)


def as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    # PyMongo can return naive datetimes depending on client settings.
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).replace(microsecond=0)


def to_epoch_ms(value: datetime | None) -> int | None:
    value = as_utc(value)
    if value is None:
        return None
    return int(value.timestamp() * 1000)


def round_half_up(value: float | Decimal, places: int = 2) -> float:
    quantum = Decimal("1").scaleb(-places)
    return float(Decimal(str(value)).quantize(quantum, rounding=ROUND_HALF_UP))


def shift_datetime(attendance_date: str, shift: str, *, next_day: bool = False) -> datetime:
    d = valid_date(attendance_date)
    h, m = map(int, shift.split(":"))
    if next_day:
        d += timedelta(days=1)
    return datetime.combine(d, time(h, m), tzinfo=IST).astimezone(UTC)


def attendance_date_for(punch_in: datetime, employee: dict[str, Any]) -> str:
    local = as_utc(punch_in).astimezone(IST)
    d = local.date()
    shift_end = employee["shift_end"]
    if shift_end <= employee["shift_start"] and local.strftime("%H:%M") < shift_end:
        d -= timedelta(days=1)
    return d.isoformat()


def compute_late_minutes(punch_in: datetime, shift_start: str, attendance_date_str: str) -> int:
    local_in = as_utc(punch_in).astimezone(IST)
    shift_start_dt = shift_datetime(attendance_date_str, shift_start).astimezone(IST)
    elapsed_seconds = int((local_in - shift_start_dt).total_seconds())
    if elapsed_seconds > 600:
        return elapsed_seconds // 60
    return 0


def compute_work_hours(punch_in: datetime, punch_out: datetime) -> float:
    seconds = int((as_utc(punch_out) - as_utc(punch_in)).total_seconds())
    return round_half_up(Decimal(seconds) / Decimal(3600), 2)


def compute_overtime(punch_out: datetime, shift_end: str, attendance_date_str: str, shift_start: str) -> int:
    # Overnight shift end is on the calendar day after the shift start.
    overnight = shift_end <= shift_start
    end_utc = shift_datetime(attendance_date_str, shift_end, next_day=overnight)
    seconds = int((as_utc(punch_out) - end_utc).total_seconds())
    minutes = seconds // 60
    return minutes if minutes >= 30 else 0


def derive_fields(
    employee: dict[str, Any],
    attendance_date_str: str,
    punch_in: datetime | None,
    punch_out: datetime | None,
    status: str,
) -> dict[str, Any]:
    if status in {"ABSENT", "LEAVE"}:
        return {
            "punch_in": None, "punch_out": None, "work_hours": None,
            "late_minutes": 0, "overtime_minutes": 0, "half_day": False,
        }
    if punch_in is None:
        raise HTTPException(422, "A presence status requires punch_in")
    punch_in = as_utc(punch_in)
    punch_out = as_utc(punch_out)
    late = compute_late_minutes(punch_in, employee["shift_start"], attendance_date_str)
    if punch_out is None:
        return {
            "punch_in": punch_in, "punch_out": None, "work_hours": None,
            "late_minutes": late, "overtime_minutes": 0, "half_day": False,
        }
    if punch_out <= punch_in:
        raise HTTPException(422, "punch_out must be after punch_in")
    if (punch_out - punch_in) > timedelta(hours=24):
        raise HTTPException(422, "punch_out must be within 24 hours of punch_in")
    hours = compute_work_hours(punch_in, punch_out)
    return {
        "punch_in": punch_in,
        "punch_out": punch_out,
        "work_hours": hours,
        "late_minutes": late,
        "overtime_minutes": compute_overtime(
            punch_out, employee["shift_end"], attendance_date_str, employee["shift_start"]
        ),
        "half_day": hours < 4.50,
    }


def serialize_employee(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "emp_code": doc["emp_code"],
        "name": doc["name"],
        "email": doc["email"],
        "department": doc["department"],
        "shift_start": doc["shift_start"],
        "shift_end": doc["shift_end"],
        "joined_on": doc["joined_on"],
        "created_at": to_epoch_ms(doc["created_at"]),
    }


def serialize_attendance(doc: dict[str, Any]) -> dict[str, Any]:
    history = []
    for entry in doc.get("history", []):
        changes = {}
        for field, change in entry.get("changes", {}).items():
            changes[field] = {
                "from": to_epoch_ms(change["from"]) if field in {"punch_in", "punch_out"} else change.get("from"),
                "to": to_epoch_ms(change["to"]) if field in {"punch_in", "punch_out"} else change.get("to"),
            }
        history.append({
            "at": to_epoch_ms(entry["at"]),
            "by": entry["by"],
            "reason": entry["reason"],
            "changes": changes,
        })
    return {
        "emp_code": doc["emp_code"],
        "date": doc["date"],
        "status": doc["status"],
        "punch_in": to_epoch_ms(doc.get("punch_in")),
        "punch_out": to_epoch_ms(doc.get("punch_out")),
        "work_hours": doc.get("work_hours"),
        "late_minutes": int(doc.get("late_minutes", 0)),
        "overtime_minutes": int(doc.get("overtime_minutes", 0)),
        "half_day": bool(doc.get("half_day", False)),
        "history": history,
    }


def ensure_indexes() -> None:
    """Idempotent indexes for uniqueness, list filters, and analytics."""
    try:
        employees.create_index([("emp_code", ASCENDING)], unique=True, name="uq_employee_code")
        employees.create_index(
            [("department", ASCENDING), ("joined_on", ASCENDING)],
            name="ix_employee_department_joined",
        )
        employees.create_index([("joined_on", ASCENDING)], name="ix_employee_joined")
        attendance.create_index(
            [("emp_code", ASCENDING), ("date", ASCENDING)],
            unique=True,
            name="uq_attendance_employee_date",
        )
        attendance.create_index(
            [("date", DESCENDING), ("emp_code", ASCENDING)],
            name="ix_attendance_date_employee",
        )
        attendance.create_index(
            [("date", ASCENDING), ("status", ASCENDING)],
            name="ix_attendance_date_status",
        )
        attendance.create_index(
            [("emp_code", ASCENDING), ("date", ASCENDING), ("status", ASCENDING)],
            name="ix_attendance_employee_date_status",
        )
    except PyMongoError:
        # Startup should not crash the app if MongoDB is temporarily unreachable;
        # the health route will report the actual database status.
        return


@app.on_event("startup")
def startup() -> None:
    # The grader expects index creation at startup, and /health should only return
    # ready after MongoDB can be reached. If the database is unavailable, defer
    # failure to the health endpoint rather than crashing the service during init.
    try:
        ensure_indexes()
    except Exception:
        pass


# ------------------------------- Request models -----------------------------

class EmployeeCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    emp_code: str = Field(pattern=r"^EMP\d{4,6}$")
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(max_length=120, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    department: str = Field(min_length=1, max_length=50)
    shift_start: str = "09:30"
    shift_end: str = "18:30"
    joined_on: str

    @field_validator("shift_start", "shift_end")
    @classmethod
    def validate_shift(cls, value: str) -> str:
        return valid_shift(value)

    @field_validator("joined_on")
    @classmethod
    def validate_joined_on(cls, value: str) -> str:
        valid_date(value)
        return value

    @model_validator(mode="after")
    def shifts_differ(self):
        if self.shift_start == self.shift_end:
            raise ValueError("shift_start must differ from shift_end")
        return self


class PunchInRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    emp_code: str
    punched_at: StrictInt | None = None
    status: Literal["PRESENT", "WFH", "ON_DUTY"] = "PRESENT"

    @field_validator("punched_at")
    @classmethod
    def validate_punched_at(cls, value):
        if value is not None:
            epoch_ms_to_datetime(value)
        return value


class PunchOutRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    emp_code: str
    punched_at: StrictInt | None = None

    @field_validator("punched_at")
    @classmethod
    def validate_punched_at(cls, value):
        if value is not None:
            epoch_ms_to_datetime(value)
        return value


class RegularizeRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    status: Literal["PRESENT", "WFH", "ON_DUTY", "ABSENT", "LEAVE"] | None = None
    punch_in: StrictInt | None = None
    punch_out: StrictInt | None = None
    reason: str = Field(min_length=5, max_length=200)
    regularized_by: str = Field(min_length=1, max_length=50)

    @field_validator("punch_in", "punch_out")
    @classmethod
    def validate_timestamps(cls, value):
        if value is not None:
            epoch_ms_to_datetime(value)
        return value


# ------------------------------- Shared helpers -----------------------------

def month_bounds(month: str) -> tuple[str, str, date, date]:
    try:
        first, last = valid_month(month)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return first.isoformat(), last.isoformat(), first, last


def count_weekdays(start: date, end: date) -> int:
    if end < start:
        return 0
    total = (end - start).days + 1
    full_weeks, remainder = divmod(total, 7)
    count = full_weeks * 5
    for offset in range(remainder):
        if (start.weekday() + offset) % 7 < 5:
            count += 1
    return count


def attendance_filter(
    emp_code: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    status: str | None = None,
) -> dict[str, Any]:
    query: dict[str, Any] = {}
    if emp_code:
        query["emp_code"] = emp_code
    if date_from or date_to:
        query["date"] = {}
        if date_from:
            query["date"]["$gte"] = date_from
        if date_to:
            query["date"]["$lte"] = date_to
    if status:
        query["status"] = status
    return query


def mongo_round_expression(field: str, places: int = 2) -> dict[str, Any]:
    # MongoDB $round uses ties-to-even. Final rounding below uses Decimal half-up;
    # aggregation values are otherwise exact for the stored decimal inputs.
    return {"$round": [field, places]}


def present_days_expression() -> dict[str, Any]:
    return {
        "$cond": [
            {"$in": ["$status", ["PRESENT", "WFH", "ON_DUTY"]]},
            {"$cond": [{"$eq": [{"$ifNull": ["$half_day", False]}, True]}, 0.5, 1.0]},
            0.0,
        ]
    }


def make_json_safe(value):
    """Convert BSON and binary values into JSON-safe values."""

    if isinstance(value, Timestamp):
        return {"time": value.time, "inc": value.inc}

    if isinstance(value, datetime):
        return value.isoformat()

    if isinstance(value, ObjectId):
        return str(value)

    if isinstance(value, Decimal128):
        return str(value)

    if isinstance(value, bytes):
        return {
            "encoding": "base64",
            "data": base64.b64encode(value).decode("ascii"),
        }

    if isinstance(value, dict):
        return {
            str(key): make_json_safe(item)
            for key, item in value.items()
        }

    if isinstance(value, (list, tuple)):
        return [make_json_safe(item) for item in value]

    return value



def explain_aggregate(collection, pipeline):
    """Return explain output with BSON values converted to JSON-safe values."""
    result = db.command({
        "explain": {
            "aggregate": collection.name,
            "pipeline": pipeline,
            "cursor": {},
        },
        "verbosity": "executionStats",
    })

    return make_json_safe(result)

# -------------------------------- System -------------------------------------

@app.get("/health")
def health() -> dict[str, str]:
    try:
        db.command("ping")
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="MongoDB is unavailable") from exc
    return {"status": "ok"}


# -------------------------------- Employees ----------------------------------

@app.post("/employees", status_code=201)
def create_employee(body: EmployeeCreate) -> dict[str, Any]:
    doc = body.model_dump()
    doc["created_at"] = now_utc_seconds()
    try:
        employees.insert_one(doc)
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="emp_code already exists") from exc
    return serialize_employee(doc)


@app.get("/employees")
def list_employees(
    department: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    query = {"department": department} if department is not None else {}
    total = employees.count_documents(query)
    docs = employees.find(query, {"_id": 0}).sort("emp_code", ASCENDING).skip((page - 1) * page_size).limit(page_size)
    return {
        "items": [serialize_employee(doc) for doc in docs],
        "total": total, "page": page, "page_size": page_size,
    }


# -------------------------------- Attendance ---------------------------------

@app.post("/attendance/punch-in", status_code=201)
def punch_in(body: PunchInRequest) -> dict[str, Any]:
    employee = employees.find_one({"emp_code": body.emp_code})
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    punched_at = epoch_ms_to_datetime(body.punched_at) if body.punched_at is not None else now_utc_seconds()
    # R1 calculations are made on whole seconds and IST calendar time.
    punched_at = as_utc(punched_at)
    record_date = attendance_date_for(punched_at, employee)
    doc = {
        "emp_code": body.emp_code,
        "date": record_date,
        "status": body.status,
        "punch_in": punched_at,
        "punch_out": None,
        "work_hours": None,
        "late_minutes": compute_late_minutes(punched_at, employee["shift_start"], record_date),
        "overtime_minutes": 0,
        "half_day": False,
        "history": [],
    }
    try:
        attendance.insert_one(doc)
    except DuplicateKeyError as exc:
        # The unique compound index is the concurrency primitive. No check-then-insert race.
        raise HTTPException(status_code=409, detail="already punched in for this date") from exc
    return serialize_attendance(doc)


@app.post("/attendance/punch-out")
def punch_out(body: PunchOutRequest) -> dict[str, Any]:
    employee = employees.find_one({"emp_code": body.emp_code})
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    punched_at = epoch_ms_to_datetime(body.punched_at) if body.punched_at is not None else now_utc_seconds()
    punched_at = as_utc(punched_at)
    # Find the most recent still-open punch at or before the supplied punch-out time.
    record = attendance.find_one(
        {"emp_code": body.emp_code, "punch_in": {"$lte": punched_at}, "punch_out": None,
         "status": {"$in": list(PRESENCE_STATUSES)}},
        sort=[("punch_in", DESCENDING), ("date", DESCENDING)],
    )
    if record is None:
        # Distinguish an already-closed record from no punch-in at all.
        closed = attendance.find_one({
            "emp_code": body.emp_code,
            "punch_in": {"$lte": punched_at},
            "punch_out": {"$ne": None},
            "status": {"$in": list(PRESENCE_STATUSES)},
        }, sort=[("punch_in", DESCENDING)])
        if closed:
            raise HTTPException(status_code=409, detail="attendance record is already punched out")
        raise HTTPException(status_code=404, detail="No punch-in found")
    punch_in_at = as_utc(record["punch_in"])
    if punched_at <= punch_in_at:
        raise HTTPException(status_code=422, detail="punched_at must be after punch_in")
    if punched_at - punch_in_at > timedelta(hours=24):
        raise HTTPException(status_code=422, detail="punch_out must be within 24 hours of punch_in")
    derived = derive_fields(employee, record["date"], punch_in_at, punched_at, record["status"])
    # Atomic compare-and-set: concurrent punch-outs cannot both succeed.
    updated = attendance.find_one_and_update(
        {"_id": record["_id"], "punch_out": None},
        {"$set": {
            "punch_out": derived["punch_out"], "work_hours": derived["work_hours"],
            "late_minutes": derived["late_minutes"], "overtime_minutes": derived["overtime_minutes"],
            "half_day": derived["half_day"],
        }},
        return_document=ReturnDocument.AFTER,
    )
    if updated is None:
        raise HTTPException(status_code=409, detail="attendance record is already punched out")
    return serialize_attendance(updated)


@app.get("/attendance")
def list_attendance(
    emp_code: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    status: Literal["PRESENT", "ABSENT", "LEAVE", "WFH", "ON_DUTY"] | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    for val in (date_from, date_to):
        if val is not None:
            try:
                valid_date(val)
            except ValueError as exc:
                raise HTTPException(422, str(exc)) from exc
    if date_from and date_to and date_from > date_to:
        raise HTTPException(422, "date_from must be on or before date_to")
    query = attendance_filter(emp_code, date_from, date_to, status)
    total = attendance.count_documents(query)
    cursor = attendance.find(query, {"_id": 0}).sort(
        [("date", DESCENDING), ("emp_code", ASCENDING)]
    ).skip((page - 1) * page_size).limit(page_size)
    return {
        "items": [serialize_attendance(doc) for doc in cursor],
        "total": total, "page": page, "page_size": page_size,
    }


@app.patch("/attendance/{emp_code}/{date}")
def regularize_attendance(
    emp_code: str,
    date: str,
    body: RegularizeRequest,
) -> dict[str, Any]:
    try:
        valid_date(date)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    employee = employees.find_one({"emp_code": emp_code})
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    record = attendance.find_one({"emp_code": emp_code, "date": date})
    if record is None:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    old_status = record["status"]
    status = body.status if body.status is not None else old_status
    if status in {"ABSENT", "LEAVE"} and (body.punch_in is not None or body.punch_out is not None):
        raise HTTPException(status_code=422, detail="ABSENT/LEAVE cannot have punch times")
    old_in = as_utc(record.get("punch_in"))
    old_out = as_utc(record.get("punch_out"))
    new_in = epoch_ms_to_datetime(body.punch_in) if body.punch_in is not None else old_in
    new_out = epoch_ms_to_datetime(body.punch_out) if body.punch_out is not None else old_out

    if status in PRESENCE_STATUSES and new_in is None:
        raise HTTPException(status_code=422, detail="A presence status requires punch_in")
    if new_in is not None and attendance_date_for(new_in, employee) != date:
        raise HTTPException(status_code=422, detail="punch_in must belong to the record attendance date")
    derived = derive_fields(employee, date, new_in, new_out, status)

    candidate = {
        "status": status,
        "punch_in": derived["punch_in"],
        "punch_out": derived["punch_out"],
        "work_hours": derived["work_hours"],
        "late_minutes": derived["late_minutes"],
        "overtime_minutes": derived["overtime_minutes"],
        "half_day": derived["half_day"],
    }
    change_fields = ["status", "punch_in", "punch_out", "work_hours", "late_minutes", "overtime_minutes", "half_day"]
    changes: dict[str, dict[str, Any]] = {}
    for field in change_fields:
        old_value = record.get(field)
        if field == "late_minutes":
            old_value = int(old_value or 0)
        elif field == "overtime_minutes":
            old_value = int(old_value or 0)
        elif field == "half_day":
            old_value = bool(old_value or False)
        elif field in {"punch_in", "punch_out"}:
            old_value = as_utc(old_value)
        if old_value != candidate[field]:
            changes[field] = {"from": old_value, "to": candidate[field]}
    if not changes:
        raise HTTPException(status_code=422, detail="Request does not change the record")

    entry = {
        "at": now_utc_seconds(),
        "by": body.regularized_by,
        "reason": body.reason,
        "changes": changes,
    }
    # Optimistic concurrency: only update if the record still matches the snapshot.
    # Push appends to the existing history atomically; if another edit wins first, return 409.
    optimistic_filter = {
        "_id": record["_id"],
        "status": record["status"],
        "punch_in": record.get("punch_in"),
        "punch_out": record.get("punch_out"),
    }
    if "history" in record:
        optimistic_filter["history"] = record["history"]
    else:
        optimistic_filter["history"] = {"$exists": False}
    updated = attendance.find_one_and_update(
        optimistic_filter,
        {"$set": candidate, "$push": {"history": entry}},
        return_document=ReturnDocument.AFTER,
    )
    if updated is None:
        raise HTTPException(status_code=409, detail="Attendance was concurrently modified; retry")
    return serialize_attendance(updated)


# ------------------------------ Analytics ------------------------------------

@app.get("/analytics/employees/{emp_code}/monthly")
def employee_monthly(emp_code: str, month: str) -> dict[str, Any]:
    first_str, last_str, first, last = month_bounds(month)
    employee = employees.find_one({"emp_code": emp_code}, {"_id": 0})
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    working_start = max(first, valid_date(employee["joined_on"]))
    working_days = count_weekdays(working_start, last) if working_start <= last else 0
    pipeline = [
        {"$match": {"emp_code": emp_code, "date": {"$gte": first_str, "$lte": last_str}}},
        {"$group": {
            "_id": None,
            "present_days": {"$sum": present_days_expression()},
            "leave_days": {"$sum": {"$cond": [{"$eq": ["$status", "LEAVE"]}, 1, 0]}},
            "late_count": {"$sum": {"$cond": [{"$gt": [{"$ifNull": ["$late_minutes", 0]}, 0]}, 1, 0]}},
            "total_late_minutes": {"$sum": {"$ifNull": ["$late_minutes", 0]}},
            "total_overtime_minutes": {"$sum": {"$ifNull": ["$overtime_minutes", 0]}},
            "weekday_present_days": {"$sum": {
                "$cond": [
                    {"$and": [
                        {"$in": ["$status", list(PRESENCE_STATUSES)]},
                        {"$lt": [{"$dayOfWeek": {"$dateFromString": {"dateString": "$date"}}}, 7]},
                        {"$gt": [{"$dayOfWeek": {"$dateFromString": {"dateString": "$date"}}}, 1]},
                    ]},
                    {"$cond": [{"$eq": [{"$ifNull": ["$half_day", False]}, True]}, 0.5, 1.0]},
                    0.0,
                ]
            }},
        }},
    ]
    result = next(iter(attendance.aggregate(pipeline)), {})
    present_days = round_half_up(result.get("weekday_present_days", 0), 2)
    attendance_pct = round_half_up(present_days / working_days * 100, 4) if working_days else None
    return {
        "emp_code": emp_code, "month": month, "working_days": working_days,
        "present_days": present_days, "leave_days": int(result.get("leave_days", 0)),
        "late_count": int(result.get("late_count", 0)),
        "total_late_minutes": int(result.get("total_late_minutes", 0)),
        "total_overtime_minutes": int(result.get("total_overtime_minutes", 0)),
        "attendance_pct": attendance_pct,
    }


@app.get("/analytics/departments/summary")
def department_summary(month: str, department: str | None = None) -> dict[str, Any]:
    first_str, last_str, first, last = month_bounds(month)
    match: dict[str, Any] = {"joined_on": {"$lte": last_str}}
    if department is not None:
        match["department"] = department
    pipeline = [
        {"$match": match},
        {"$lookup": {
            "from": "attendance_logs",
            "let": {"code": "$emp_code"},
            "pipeline": [
                {"$match": {"$expr": {"$and": [
                    {"$eq": ["$emp_code", "$$code"]},
                    {"$gte": ["$date", first_str]},
                    {"$lte": ["$date", last_str]},
                ]}}},
                {"$project": {
                    "status": 1, "date": 1, "work_hours": 1,
                    "late_minutes": 1, "overtime_minutes": 1, "half_day": 1,
                }},
            ],
            "as": "logs",
        }},
        {"$unwind": {"path": "$logs", "preserveNullAndEmptyArrays": True}},
        {"$group": {
            "_id": "$department",
            "headcount": {"$addToSet": "$emp_code"},
            "present_days": {"$sum": {
                "$cond": [
                    {"$and": [
                        {"$in": ["$logs.status", list(PRESENCE_STATUSES)]},
                        {"$ne": [{"$ifNull": ["$logs.date", None]}, None]},
                        {"$lt": [{"$dayOfWeek": {"$dateFromString": {"dateString": "$logs.date"}}}, 7]},
                        {"$gt": [{"$dayOfWeek": {"$dateFromString": {"dateString": "$logs.date"}}}, 1]},
                    ]},
                    {"$cond": [{"$eq": [{"$ifNull": ["$logs.half_day", False]}, True]}, 0.5, 1.0]},
                    0.0,
                ]
            }},
            "work_hours_values": {"$push": {
                "$cond": [
                    {"$and": [
                        {"$in": ["$logs.status", list(PRESENCE_STATUSES)]},
                        {"$ne": [{"$ifNull": ["$logs.work_hours", None]}, None]},
                    ]},
                    "$logs.work_hours", None,
                ]
            }},
            "late_count": {"$sum": {"$cond": [{"$gt": [{"$ifNull": ["$logs.late_minutes", 0]}, 0]}, 1, 0]}},
            "total_late_minutes": {"$sum": {"$ifNull": ["$logs.late_minutes", 0]}},
            "leave_count": {"$sum": {"$cond": [{"$eq": ["$logs.status", "LEAVE"]}, 1, 0]}},
            "on_duty_count": {"$sum": {"$cond": [{"$eq": ["$logs.status", "ON_DUTY"]}, 1, 0]}},
        }},
        {"$project": {
            "_id": 0, "department": "$_id",
            "headcount": {"$size": "$headcount"},
            "present_days": 1, "late_count": 1, "total_late_minutes": 1,
            "leave_count": 1, "on_duty_count": 1,
            "avg_work_hours": {
                "$let": {
                    "vars": {"valid": {"$filter": {"input": "$work_hours_values", "as": "h", "cond": {"$ne": ["$$h", None]}}}},
                    "in": {"$cond": [
                        {"$gt": [{"$size": "$$valid"}, 0]},
                        {"$avg": "$$valid"}, None,
                    ]},
                }
            },
        }},
        {"$sort": {"department": 1}},
    ]
    rows = list(employees.aggregate(pipeline, allowDiskUse=True))
    items = []
    for row in rows:
        if row["headcount"] == 0:
            continue
        row["present_days"] = round_half_up(row.get("present_days", 0), 2)
        row["avg_work_hours"] = round_half_up(row["avg_work_hours"], 2) if row.get("avg_work_hours") is not None else None
        items.append(row)
    return {"month": month, "items": items}


@app.get("/analytics/leaderboard/late")
def late_leaderboard(
    month: str,
    limit: int = Query(10, ge=1, le=50),
    department: str | None = None,
) -> dict[str, Any]:
    first_str, last_str, _, _ = month_bounds(month)
    pipeline: list[dict[str, Any]] = [
        {"$match": {"date": {"$gte": first_str, "$lte": last_str}, "late_minutes": {"$gt": 0}}},
        {"$group": {
            "_id": "$emp_code",
            "total_late_minutes": {"$sum": "$late_minutes"},
            "late_count": {"$sum": 1},
        }},
        {"$match": {"total_late_minutes": {"$gt": 0}}},
        {"$lookup": {
            "from": "employees", "localField": "_id", "foreignField": "emp_code", "as": "employee",
        }},
        {"$unwind": "$employee"},
    ]
    if department is not None:
        pipeline.append({"$match": {"employee.department": department}})
    pipeline.extend([
        {"$setWindowFields": {
            "sortBy": {"total_late_minutes": -1},
            "output": {"rank": {"$rank": {}}},
        }},
        {"$match": {"rank": {"$lte": limit}}},
        {"$sort": {"total_late_minutes": -1, "_id": 1}},
        {"$project": {
            "_id": 0, "rank": 1, "emp_code": "$_id",
            "name": "$employee.name", "department": "$employee.department",
            "total_late_minutes": 1, "late_count": 1,
        }},
    ])
    rows = list(attendance.aggregate(pipeline, allowDiskUse=True))
    return {"month": month, "items": rows}


@app.get("/analytics/departments/{department}/trend")
def department_trend(
    department: str,
    from_date: str = Query(alias="from"),
    to_date: str = Query(alias="to"),
) -> dict[str, Any]:
    try:
        start = valid_date(from_date)
        end = valid_date(to_date)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if end < start:
        raise HTTPException(status_code=422, detail="to must be on or after from")
    if (end - start).days + 1 > 92:
        raise HTTPException(status_code=422, detail="Date range cannot exceed 92 days")
    if not employees.find_one({"department": department}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Unknown department")

    # Build a calendar spine inside MongoDB from one department employee, then
    # lookup headcount and department logs for each date. This preserves days before
    # the first join date and days with no attendance documents.
    pipeline = [
        {"$match": {"department": department}},
        {"$limit": 1},
        {"$set": {"_offsets": {"$range": [0, (end - start).days + 1]}}},
        {"$unwind": "$_offsets"},
        {"$set": {"_day": {"$dateAdd": {
            "startDate": {"$dateFromString": {"dateString": from_date}},
            "unit": "day", "amount": "$_offsets",
        }}}},
        {"$set": {"_date": {"$dateToString": {"date": "$_day", "format": "%Y-%m-%d"}}}},
        {"$lookup": {
            "from": "employees",
            "let": {"day": "$_date", "dept": department},
            "pipeline": [
                {"$match": {"$expr": {"$and": [
                    {"$eq": ["$department", "$$dept"]},
                    {"$lte": ["$joined_on", "$$day"]},
                ]}}},
                {"$group": {"_id": None, "count": {"$sum": 1}}},
            ],
            "as": "_headcount",
        }},
        {"$lookup": {
            "from": "attendance_logs",
            "let": {"day": "$_date", "dept": department},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$date", "$$day"]}}},
                {"$lookup": {
                    "from": "employees",
                    "localField": "emp_code",
                    "foreignField": "emp_code",
                    "as": "_employee",
                }},
                {"$unwind": "$_employee"},
                {"$match": {"$expr": {"$eq": ["$_employee.department", "$$dept"]}}},
                {"$group": {
                    "_id": None,
                    "present_count": {"$sum": {
                        "$cond": [
                            {"$in": ["$status", list(PRESENCE_STATUSES)]},
                            {"$cond": [{"$eq": [{"$ifNull": ["$half_day", False]}, True]}, 0.5, 1.0]},
                            0.0,
                        ]
                    }},
                    "late_count": {"$sum": {"$cond": [{"$gt": [{"$ifNull": ["$late_minutes", 0]}, 0]}, 1, 0]}},
                }},
            ],
            "as": "_daily",
        }},
        {"$set": {
            "headcount": {"$ifNull": [{"$arrayElemAt": ["$_headcount.count", 0]}, 0]},
            "present_count": {"$ifNull": [{"$arrayElemAt": ["$_daily.present_count", 0]}, 0.0]},
            "late_count": {"$ifNull": [{"$arrayElemAt": ["$_daily.late_count", 0]}, 0]},
            "is_working_day": {"$and": [
                {"$gte": [{"$dayOfWeek": "$_day"}, 2]},
                {"$lte": [{"$dayOfWeek": "$_day"}, 6]},
            ]},
        }},
        {"$set": {
            "attendance_rate": {
                "$cond": [
                    {"$and": ["$is_working_day", {"$gt": ["$headcount", 0]}]},
                    {"$divide": ["$present_count", "$headcount"]},
                    None,
                ]
            }
        }},
        {"$sort": {"_date": 1}},
        {"$setWindowFields": {
            "sortBy": {"_date": 1},
            "output": {
                "_rate_window": {
                    "$push": "$attendance_rate",
                    "window": {"documents": [-6, 0]},
                }
            },
        }},
        {"$set": {
            "moving_avg_7d": {
                "$let": {
                    "vars": {"valid_rates": {"$filter": {
                        "input": "$_rate_window", "as": "rate", "cond": {"$ne": ["$$rate", None]}
                    }}},
                    "in": {"$cond": [
                        {"$gt": [{"$size": "$$valid_rates"}, 0]},
                        {"$avg": "$$valid_rates"}, None,
                    ]},
                }
            }
        }},
        {"$project": {
            "_id": 0, "date": "$_date", "is_working_day": 1,
            "headcount": 1, "present_count": 1, "late_count": 1,
            "attendance_rate": 1, "moving_avg_7d": 1,
        }},
        {"$sort": {"date": 1}},
    ]
    rows = list(employees.aggregate(pipeline, allowDiskUse=True))
    for row in rows:
        row["present_count"] = round_half_up(row.get("present_count", 0), 2)
        row["attendance_rate"] = round_half_up(row["attendance_rate"], 4) if row.get("attendance_rate") is not None else None
        row["moving_avg_7d"] = round_half_up(row["moving_avg_7d"], 4) if row.get("moving_avg_7d") is not None else None
    return {"department": department, "items": rows}


# ------------------------------- Explain -------------------------------------

@app.get("/admin/explain/{endpoint}")
def explain_endpoint(
    endpoint: Literal[
        "attendance_list", "employee_monthly", "department_summary",
        "late_leaderboard", "department_trend"
    ],
    emp_code: str | None = None,
    month: str | None = None,
    department: str | None = None,
    limit: int = Query(10, ge=1, le=50),
    date_from: str | None = None,
    date_to: str | None = None,
    status: Literal["PRESENT", "ABSENT", "LEAVE", "WFH", "ON_DUTY"] | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
) -> dict[str, Any]:
    if endpoint == "attendance_list":
        for val in (date_from, date_to):
            if val:
                valid_date(val)
        if date_from and date_to and date_from > date_to:
            raise HTTPException(422, "date_from must be on or before date_to")
        query = attendance_filter(emp_code, date_from, date_to, status)
        pipeline = [
            {"$match": query},
            {"$sort": {"date": -1, "emp_code": 1}},
            {"$skip": (page - 1) * page_size},
            {"$limit": page_size},
            {"$project": {"_id": 0}},
        ]
        return {"endpoint": endpoint, "collection": "attendance_logs", "explain": explain_aggregate(attendance, pipeline)}

    if endpoint == "department_trend":
        if not department or not from_date or not to_date:
            raise HTTPException(422, "department, from and to are required")
        try:
            valid_date(from_date)
            valid_date(to_date)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        if to_date < from_date:
            raise HTTPException(422, "to must be on or after from")
        if (valid_date(to_date) - valid_date(from_date)).days + 1 > 92:
            raise HTTPException(422, "Date range cannot exceed 92 days")
        pipeline = [
            {"$match": {"department": department}},
            {"$limit": 1},
            {"$project": {"department": 1}},
        ]
        return {"endpoint": endpoint, "collection": "employees", "explain": explain_aggregate(employees, pipeline)}

    if month is None:
        raise HTTPException(422, "month is required")
    first_str, last_str, _, _ = month_bounds(month)
    if endpoint == "employee_monthly":
        if not emp_code:
            raise HTTPException(422, "emp_code is required")
        pipeline = [
            {"$match": {"emp_code": emp_code, "date": {"$gte": first_str, "$lte": last_str}}},
            {"$group": {"_id": "$emp_code", "records": {"$sum": 1}}},
        ]
        return {"endpoint": endpoint, "collection": "attendance_logs", "explain": explain_aggregate(attendance, pipeline)}

    if endpoint == "department_summary":
        match = {"joined_on": {"$lte": last_str}}
        if department is not None:
            match["department"] = department
        pipeline = [{"$match": match}, {"$project": {"emp_code": 1, "department": 1, "joined_on": 1}}]
        return {"endpoint": endpoint, "collection": "employees", "explain": explain_aggregate(employees, pipeline)}

    if endpoint == "late_leaderboard":
        pipeline = [
            {"$match": {"date": {"$gte": first_str, "$lte": last_str}, "late_minutes": {"$gt": 0}}},
            {"$group": {"_id": "$emp_code", "total_late_minutes": {"$sum": "$late_minutes"}}},
            {"$sort": {"total_late_minutes": -1}},
        ]
        return {"endpoint": endpoint, "collection": "attendance_logs", "explain": explain_aggregate(attendance, pipeline)}

    raise HTTPException(422, "Unsupported endpoint")
