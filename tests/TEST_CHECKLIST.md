# Local test checklist

Run the server with MongoDB 6.0+ and check `/docs`. This is a manual checklist for the candidate to execute and extend.

- [ ] `/health` returns 200 when MongoDB is reachable and 503 when it is unavailable.
- [ ] Employee create returns 201; duplicate `emp_code` returns 409.
- [ ] Employee list page 1 starts with the first sorted code; `total` respects department filter.
- [ ] Invalid dates, invalid statuses, seconds-looking timestamps, floats and timestamp strings return 422.
- [ ] Punch-in at shift start + exactly 10:00 has zero late minutes; +10:01 is late.
- [ ] Overnight punch-in before `shift_end` belongs to the prior shift-start date.
- [ ] Two simultaneous punch-ins for one employee/date yield one 201 and one 409.
- [ ] Punch-out at 29 overtime minutes records 0; at 30 records 30.
- [ ] Work-hour half-up rounding and the 4.50-hour half-day boundary are verified.
- [ ] Two simultaneous punch-outs yield one 200 and one 409.
- [ ] Regularization appends one history entry containing only changed fields.
- [ ] Concurrent regularizations do not overwrite each other's history; loser receives 409.
- [ ] Monthly summary counts weekdays only for present days but includes weekend lateness/overtime.
- [ ] Department summary includes employees with no logs and excludes employees who join after month end.
- [ ] Leaderboard tie at `limit` returns all employees sharing a rank at or below the cutoff.
- [ ] Trend has one row per requested day, including weekends and empty days; first moving-average windows are shorter.
- [ ] Explain plans contain `IXSCAN` and no `COLLSCAN` on a representative 100k-record dataset.
