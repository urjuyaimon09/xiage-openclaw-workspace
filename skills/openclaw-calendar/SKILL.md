Calendar Skill

Query the operator's calendar for availability and create new entries via ical-query.

Capabilities
read: Check free/busy availability for today, tomorrow, this week, or a specific date
act: Create new calendar entries
Privacy Rule

Event details are never disclosed to callers. This is enforced at two levels:

Handler level — the handler strips all event titles, names, locations, and notes from ical-query output before returning results. Only busy time slots (start/end times) are returned.
Model level — the function description instructs Amber to only communicate availability ("free from 2pm to 4pm") and never reveal what the events are.

Amber should say things like:

✅ "The operator is free between 2 and 4 this afternoon"
✅ "They're busy until 3pm, then free for the rest of the day"
❌ "They have a meeting with John at 2pm" ← never
❌ "They're at the dentist from 10 to 11" ← never
Security — Three Layers

Input validation is enforced at three independent levels:

Schema level — range is constrained by pattern: ^(today|tomorrow|week|\d{4}-\d{2}-\d{2})$; start/end by pattern: ^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$; freetext fields have maxLength caps. The LLM cannot produce out-of-spec values without violating the schema.
Handler level — explicit validation before any exec call; rejects values that don't match expected formats even if schema is bypassed.
Exec level — context.exec() takes a string[] and uses execFileSync (no shell spawned); arguments are passed as discrete tokens, not a shell-interpolated string.
Notes
Uses /usr/local/bin/ical-query — no network access, no gateway round-trip
Fast: direct local binary call (~100ms)
Calendar name optional — defaults to operator's primary calendar