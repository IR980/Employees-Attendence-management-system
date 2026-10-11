# DECISIONS.md

1. **Indexes.** I use a unique `employees.emp_code` index for employee identity, and a unique `(emp_code, date)` index to enforce one attendance record per employee per attendance day. The attendance date/employee index supports the main list ordering; employee/date/status supports employee summaries and filters; date/status supports monthly analytics. A `(department, joined_on)` index supports department headcount and trend queries. I considered a separate index on `late_minutes`, but date-bounded monthly queries benefit more from the date-leading indexes, and another index would increase write cost.

2. **Punch-in race.** Both requests may reach the insert, but the unique compound index permits only one document for `(emp_code, date)`. MongoDB accepts one insert; the other raises `DuplicateKeyError`, which the API maps to 409. The endpoint does not rely on a prior read to prevent duplicates.

3. **Ties.** `$rank` gives equal totals the same rank and skips the next rank. The `rank <= limit` filter is applied after ranking, so every employee tied at the cutoff is returned. Rows are then ordered by total late minutes and `emp_code`.

4. **Headcount.** Department summary starts from employees who joined on or before the month end, then uses `$lookup` with `preserveNullAndEmptyArrays` behavior. Employees without logs remain in the group and count toward headcount.

5. **100x data.** I would validate the index choices with production-like explain plans and metrics, then consider a pre-aggregated daily summary collection maintained safely on writes or through a change stream. That would reduce repeated large monthly scans while preserving raw logs for auditability.
