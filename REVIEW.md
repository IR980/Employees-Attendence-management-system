# REVIEW.md

The starter has several correctness, contract, and scale defects. Verify these findings against your final implementation and add/remove rows if your own edits change the details.

| # | Where | What is wrong | How to notice | Fix in this implementation |
|---|---|---|---|---|
| 1 | `health()` | Always returns 200 without checking MongoDB. | Stop MongoDB and call `/health`. | Executes `ping`; maps connectivity failure to 503. |
| 2 | MongoClient setup | PyMongo timezone handling is implicit; defaults can return naive datetimes. | Serialize a seeded BSON date. | Uses timezone-aware UTC client and normalizes values at boundaries. |
| 3 | `compute_late_minutes()` | Assumes the timestamp's local date/time and does not correctly handle overnight attendance dates/time zones. | Punch around midnight on a night shift. | Converts UTC instants to IST and calculates against the attendance date. |
| 4 | `compute_work_hours()` | Python `round()` uses ties-to-even and binary floats. | Exercise a half-way rounding case. | Uses `Decimal` with `ROUND_HALF_UP`. |
| 5 | `compute_overtime()` | Does not handle overnight shift end on the following day and counts overtime under 30 minutes. | Punch out 20 minutes late or on a night shift. | Uses next-day shift end for overnight shifts and applies the 30-minute threshold. |
| 6 | `EmployeeIn` | Missing schema constraints and permits equal shift start/end. | Send malformed employee code, date, or identical shift times. | Pydantic constraints and validators enforce contract shapes. |
| 7 | `create_employee()` | Check-then-insert is racy; `created_at` is naive; duplicate handling is not database-enforced. | Send parallel requests with the same code. | Unique index and `DuplicateKeyError` handling; server UTC timestamp. |
| 8 | `list_employees()` | `skip = page * page_size` skips page one; total ignores the department filter; no sorting or page validation. | Request page 1 and filter by department. | Correct skip, filtered count, stable sort, bounded query parameters. |
| 9 | `punch_in()` | Missing employee is dereferenced; timestamp conversion uses host local timezone; status is not validated; response leaks an `id`; duplicate check-then-insert is racy. | Unknown employee, invalid status, parallel same-day punches. | Validated request, IST date derivation, no internal ID in response, unique natural-key index. |
| 10 | `punch_in()` | Timestamp seconds/floats/strings and unsupported ranges are not rejected; sub-second instants are not truncated. | Send seconds or a float timestamp. | Strict epoch-millisecond validation and whole-second truncation. |
| 11 | `list_attendance()` | Reads every matching document into Python, sorts/paginates in memory, and leaks Mongo `_id` as `id`. | Use a large dataset or inspect response fields. | Filter/sort/count/skip/limit are executed in MongoDB; natural fields only in response. |
| 12 | `list_attendance()` | Sort tie-breaker, date validation, status validation, and date range ordering are missing. | Same-date records or `date_from > date_to`. | Stable compound sort and request validation. |
| 13 | `punch_out()` | Not implemented in starter. | Call the endpoint. | Atomic compare-and-set closes the latest open record and calculates derived fields. |
| 14 | Regularization | Not implemented in starter. | Call the PATCH endpoint. | Validates status/time combinations, recomputes derived fields and appends an audit entry. |
| 15 | Analytics | All required analytics endpoints are missing. | Call any analytics route. | Adds aggregation-based monthly, department, leaderboard and trend endpoints. |
| 16 | Explain | Explain endpoint is missing. | Call `/admin/explain/...`. | Adds executionStats explain output for the supported query families. |

## Reviewed and retained
- The employee business key is `emp_code`, not MongoDB `_id`.
- Calendar dates and shift times are strings, while instants are BSON dates.
- `history` is for manual corrections only; punch-in/out should not append history.
- Analytics should consume stored derived fields, not recompute seeded values from timestamps.
