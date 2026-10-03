# Scheduling coordinator

Books, moves, and cancels appointments for a clinic, salon, or services firm so providers' days stay full, clients show up, and nobody is double-booked.

## 1. Purpose and who the role serves
The coordinator owns the calendar: fill every provider's day, keep gaps and overruns out, and absorb the churn of requests, reschedules, cancellations, and no-shows without upsetting clients or burning out providers. It serves clients (a slot that fits, clear expectations, no surprise fees), providers (a realistic day with buffers and the right room), the owner or practice manager (utilization, no-show rate, deposit revenue), and the front desk (an accurate schedule). Provider time and client goodwill are both revenue; protect both.

## 2. Daily tasks
- Work the request queue (phone, web form, email, walk-ins), oldest first.
- Run the confirmation pass for tomorrow and the day after; chase anyone not Confirmed.
- Process cancellations and reschedules, apply the cancellation policy, log the reason.
- Fill freshly opened slots from the waitlist, highest priority first.
- Scan today's schedule for double_booked, missing buffer_min, room or equipment clashes.
- Collect deposits where required and mark deposit_paid.
- Mark no-shows after the grace period, update no_show_count, apply or waive the fee.
- Handle provider changes (sick days, late starts, blocked time) and move affected clients.
- Keep client records current: phone, email, preferred provider, access notes.
- Report end of day: bookings, cancellations, no-shows, open slots tomorrow.

## 3. Software and screens typically used
- **Google Calendar** (or the calendar view in Acuity, Square Appointments, Mindbody, or a clinic EHR): one calendar per provider, color-coded by service. Day and week views are where you spot overlaps, gaps, and missing buffers. Each event holds client, service, start_time, duration_min, notes.
- **Appointment list / request queue**: a table with appointment_no, client, provider, service, start_time, duration_min, double_booked, buffer_min, notice_hours, no_show_count, deposit_paid, status. Actions: book, reschedule, cancel, waive_fee, waitlist.
- **Excel / Google Sheets**: the waitlist (client, service, preferred provider, earliest date, flexibility, date added), the no-show log, weekly utilization.
- **Gmail / Outlook** plus SMS: confirmations, reminders, cancellation notices, deposit requests.

## 4. The standard workflow, step by step, done the right way
1. Open the request. Check client: existing or new? Pull history and no_show_count before offering anything.
2. Check service and provider: does this provider do this service, is the room or equipment free? No preference: offer the provider with the most open time.
3. Check duration_min against the service standard (30 min consult, 60 min massage, 90 min color) plus the provider's buffer_min (typically 10-15 min for cleanup or charting). The slot must fit both.
4. Check notice_hours. Under 24: treat as same-day, confirm the provider can take it.
5. Check deposit rules. New clients, services over about $100, and no_show_count of 2 or more require a deposit (20-50% or a flat $25-50). Collect it, set deposit_paid Yes, then book.
6. Check double_booked is No. If there's an overlap, don't book; find the next clean slot.
7. Click book: status Requested to Booked. Send the confirmation with date, time, provider, service, address, and the cancellation policy in plain words.
8. At 24-48 hours out, send the reminder. When the client replies, set Confirmed. No reply by the morning of: call once, log it.
9. For a cancellation: record reason and notice_hours, click cancel, apply the fee if under 24 hours, then immediately pull from the waitlist to refill.
10. For a no-show: wait the grace period (10-15 minutes), mark No show, increment no_show_count, apply the fee or waive_fee with a logged reason.
11. End of day: scan tomorrow for unconfirmed appointments, missing deposits, any double_booked Yes.

## 5. Common judgment calls
- **Client cancels 20 hours out on a 60-minute service with a $50 late fee.** Standard answer: inside the 24-hour window, so the fee applies; on a first offence where the slot refills from the waitlist, most practices waive it. Charge when the slot stays empty or no_show_count is already 1 or more. Log the reason either way.
- **Client wants a 90-minute service in a 60-minute gap.** Standard answer: don't squeeze it. Offer the next slot that fits duration_min plus buffer_min. Overruns cascade through the afternoon.
- **A regular wants a same-day slot that's full.** Standard answer: waitlist and a call-back if anything opens. Never bump a confirmed client. Whether the provider shortens lunch is the provider's call.
- **Provider calls in sick with eight clients booked.** Standard answer: call in start_time order, offer the same day with another qualified provider first, then next available with the original. Waive all fees. Phone, then text; email isn't enough.
- **New client refuses a deposit, "I'll pay at the visit".** Standard answer: hold the line. Offer to hold the slot 24 hours pending payment, then release it.
- **no_show_count of 3 wants to rebook.** Standard answer: full prepayment only, said plainly. Many clinics go prepay-only at the third no-show and discharge at the fourth or fifth.
- **Preferred provider is booked six weeks out; another is free tomorrow.** Standard answer: offer both and let the client choose; waitlist them for the preferred provider.

## 6. Standard guardrails
- Cancellation under 24 hours: late fee (commonly $25-50 or 50% of the service). Under 2 hours or no-show: full fee or forfeited deposit. Every waive_fee needs a logged reason.
- Deposit required when the service is over about $100, the client is new, or no_show_count is 2 or more. Never set Booked with deposit_paid No on these.
- double_booked Yes: stop. Never book over an existing appointment, even "just 10 minutes".
- buffer_min below the provider's minimum (10 typical, 15 for procedures needing cleanup, 30 for sedation or chemical processing): manager decision, not yours.
- No-show grace period: 10-15 minutes. Don't mark at minute 5; don't hold past 15 without the provider's say.
- Waiving a fee twice for the same client in 90 days, or any fee over $100: ask the manager first.
- Medical or sensitive services: never name the service in voicemail or SMS; say "your appointment with Dr. X". Share schedule details only with the client or an authorized contact on file.
- Provider availability changes (blocks, shorter days): only the provider or manager authorizes; you execute.
- Business-caused cancellations (provider sick, equipment down): waive every fee, priority rebooking, report the count to the manager.

## 7. Mistakes new hires commonly make
- Booking on duration_min alone and ignoring buffer_min; the provider is 20 minutes behind by noon.
- Setting Confirmed when the reminder was sent, not when the client replied. Confirmed means the client said yes.
- Waiving fees because the client sounded upset. Waive on criteria, not tone.
- Leaving a cancelled slot empty instead of working the waitlist immediately; prime-time slots go stale within hours.
- Booking a new client without a deposit to be nice, then eating the no-show.
- Not logging cancellation reasons, so patterns (one provider getting all the late cancels) stay invisible.
- Rescheduling by creating a new appointment and leaving the old one Booked, creating a phantom and a double_booked flag.
- Naming a client's medical service in a voicemail.

## 8. Vocabulary
- **Buffer**: minutes blocked after an appointment for cleanup, notes, or travel; buffer_min.
- **Notice hours**: time between a request or cancellation and the slot; drives fee and same-day rules.
- **Late cancel**: cancellation inside the policy window, usually 24 hours.
- **No-show**: client did not arrive within the grace period; increments no_show_count.
- **Grace period**: minutes you wait before marking No show, typically 10-15.
- **Deposit**: prepayment that holds a slot and is forfeited on no-show; deposit_paid.
- **Prepay-only**: full payment required before booking, usually after repeated no-shows.
- **Waitlist**: ordered list of clients wanting an earlier or specific slot; status Waitlisted.
- **Double-booking**: two appointments overlapping on one provider or room; double_booked Yes.
- **Overrun**: appointment running past its scheduled end, eating the next buffer.
- **Utilization**: booked minutes divided by available minutes per provider.
- **Block**: provider time removed from availability for lunch, admin, or leave.
- **Confirmation**: client's reply that they will attend; sets Confirmed.
- **Reminder**: outbound message 24-48 hours before the slot.
- **Recall**: follow-up booked at the end of a visit, e.g. a six-month cleaning.
- **Walk-in**: client with no appointment; fits only into open or cancelled slots.
- **Same-day fill**: refilling a cancelled slot the day it opens.
- **Provider**: the clinician, stylist, or technician delivering the service.
- **Service standard**: default duration_min and price for each service.
- **Discharge**: formally ending the client relationship after repeated policy violations.
