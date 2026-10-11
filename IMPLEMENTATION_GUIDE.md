# Implementation Guide (read before using the code)

## 1. Required repository shape

```text
hrone-attendance-solution/
├── app/
│   ├── __init__.py
│   └── main.py
├── tests/
│   └── TEST_CHECKLIST.md
├── .gitignore
├── requirements.txt
├── README.md
├── REVIEW.md
└── DECISIONS.md
```

The assignment specifically requires all application code to live in `app/main.py`. Keep the implementation in that file for submission. Do not add the confidential problem statement, sample data dumps, `.env`, secrets, a Dockerfile, or a virtual environment to the public repository.

## 2. Implementation sequence

1. **Configuration and MongoDB:** environment-driven connection, UTC-aware BSON date handling, idempotent index creation.
2. **Validation and conversion helpers:** strict epoch milliseconds, ISO calendar dates, IST shift arithmetic, whole-second truncation, half-up rounding.
3. **Request models:** enforce employee-code, shift, status and timestamp constraints before touching the database.
4. **Employee routes:** database uniqueness handles concurrent duplicate employee codes; listing uses server-side filters, sort and pagination.
5. **Punch-in:** derive the IST attendance date and late minutes; rely on the unique `(emp_code, date)` index for race safety.
6. **Punch-out:** select the latest eligible open record; atomically update only while `punch_out` remains null.
7. **Regularization:** validate final status/times, recalculate derived values, compute a field-by-field diff, and append one immutable history entry with optimistic concurrency.
8. **Analytics:** use MongoDB aggregation pipelines and stored derived fields. Verify weekend, join-date, missing-log, tie and gap-filling cases.
9. **Explain endpoint:** run `executionStats` explain for each supported query family and inspect `IXSCAN`/`COLLSCAN`.
10. **Review and decisions:** rewrite the documents in your own words after validating that they accurately describe the final code.

## 3. Key business-rule reminders

- API instants are integer epoch milliseconds; MongoDB instants are UTC BSON dates.
- All instants are truncated to whole seconds before calculation and persistence.
- Attendance date is the IST date, except overnight-shift punches before `shift_end` belong to the previous shift-start date.
- The late grace is strictly greater than 10 minutes. Overtime is counted only at 30 whole minutes or more.
- Work hours use decimal half-up rounding to two decimals; `half_day` is true when the rounded result is below 4.50.
- Present days count only weekdays, while weekend logs still contribute to lateness/overtime totals.
- Monthly analytics use stored `late_minutes`, `overtime_minutes`, `work_hours`, and `half_day`.
- `history` records regularizations only, not ordinary punches.

## 4. Verification required before submission

This bundle was syntax-checked, but a live MongoDB integration run was not possible in the file-generation environment because PyMongo/MongoDB were not installed there. Do not treat syntax validation as proof that every query works. Run the checklist against MongoDB 7.0 and add automated tests before submitting.

Particular areas to inspect carefully:
- MongoDB aggregation syntax/behavior on your target MongoDB version.
- The trend endpoint's generated calendar and moving-average window.
- Whether every explain pipeline matches the real endpoint's query and demonstrates indexed execution.
- All response shapes/status codes against `openapi.yaml`.
- Parallel request behavior and the exact hidden-test edge cases.

The assignment says candidates must understand every line and will be asked to modify the code live. Use this implementation as a study baseline, validate it, and make sure you can explain each decision yourself.
