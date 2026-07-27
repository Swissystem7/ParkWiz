# TASKS — ParkWiz

Task queue for the local Ollama agent. One line per task, `- [ ]` = open, `- [x]` = done.
Tasks must be small, self-contained browser JS, verifiable. The agent implements the
topmost open task, injects the function into index.html, and marks it done.

- [ ] Write function formatIls(amount) that returns a Hebrew-friendly price string like "₪32" for 32 and "₪32.50" for 32.5, throwing TypeError on non-finite input.
- [ ] Write function walkMinutesLabel(minutes) returning "פחות מדקה" for values under 1, "דקה אחת" for exactly 1, and "N דקות הליכה" otherwise; throw RangeError on negative input.
- [ ] Write function bookingWindowRemaining(nowMs, releaseAtMs) returning whole minutes left, 0 when the window has passed, throwing TypeError if either argument is not a finite number.
- [ ] Write function summarizeBooking(booking) taking {id, priceIls, windowMins} and returning a one-line Hebrew summary string; throw TypeError when a required field is missing.
