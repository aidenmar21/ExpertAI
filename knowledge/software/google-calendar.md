# Google Calendar
The scheduling surface for clinics, salons, hotels and HR teams that run on Google Workspace: events, guests, booking pages and the shared calendars that show who is where.

## 1. What it is and who uses it
Google Calendar is the calendar inside Google Workspace, opened in the browser at calendar.google.com or in the mobile app, and wired into Gmail (invites arrive as cards) and Google Meet. Scheduling coordinators use it as the provider schedule, with one calendar per provider or room. Front-desk staff use it for shuttle times, housekeeping blocks and manager shifts. HR coordinators use it for start-date orientations, IT setup slots and 30/60/90-day check-ins. Appointment schedules (the booking page feature) let clients pick their own slot, which removes the back-and-forth but also removes the human check.

## 2. Main screens and objects
- **Main grid** with the view switcher at top-right: Day, Week, Month, Year, Schedule (agenda list), 4 days. Today button and arrows at top-left.
- **Mini calendar** and **My calendars / Other calendars** lists on the left, each with a colour swatch and a checkbox to show or hide.
- **Event detail popup** (click an event) and the full **Event editor** (Edit, pencil icon).
- **Create button** (top-left, plus sign) with Event, Task, Appointment schedule, Focus time, Out of office, Working location.
- **Appointment schedules**: the booking page editor (title, duration, availability window, buffer, max bookings per day, booking form fields) and the public booking page link.
- **Find a time** tab inside the event editor, showing the guests' calendars side by side, and **Suggested times**.
- **Rooms and resources** picker (Meeting rooms, Treatment Room 2, Van 1).
- **Settings**: time zone, secondary time zone, working hours, event notifications defaults, "Add invitations to my calendar" rules, calendar sharing (See only free/busy, See all event details, Make changes to events, Make changes and manage sharing).
- **Trash** for the calendar (deleted events, 30 days).

## 3. Field names and statuses you would see
- Event editor fields: Title, Date, Start time, End time, All day (toggle), Time zone, Does not repeat / Daily / Weekly on Monday / Monthly on the first Monday / Annually / Every weekday / Custom, Add guests, Guest permissions (Modify event, Invite others, See guest list), Add Google Meet video conferencing, Add rooms or location, Add description or attachments, Calendar (which calendar it lives on), Busy / Free, Default visibility / Public / Private, Notification (10 minutes before, 1 day before, Email 1 day before), Colour.
- Guest RSVP statuses in the guest list: Yes, No, Maybe, Awaiting (grey question mark); counts shown as "3 yes, 1 awaiting, 1 no". Each guest row may say Optional or Organiser.
- Event states on the grid: solid block (accepted or own), outlined/hollow block (not yet responded), strikethrough or faded block (declined), diagonal stripes (tentative/Maybe), lock icon (Private), a small repeat arrow icon (recurring), a camera icon (Meet), a people icon (guests), and "Out of office" shown as a grey block with auto-decline.
- Appointment schedule fields: Appointment title, Appointment duration (15 min, 30 min, 45 min, 1 hour, custom), General availability (repeat weekly / does not repeat), Adjusted availability (date overrides), Scheduling window ("Available now", "Up to 60 days in advance", "At least 24 hours before start"), Booked appointment settings: Buffer time (0 to 60 min between appointments), Maximum bookings per day, Guest permissions ("Guests can invite others"), Booking form (First name, Last name, Email, Phone number, custom questions), Booking confirmations and reminders (Email reminder 1 day before), Payments (Stripe), Calendar for bookings.
- Booked slots appear on the calendar with the client's name and "(via appointment schedule)" in the details.
- Working hours banner: "Outside working hours" warning on an invite; "Guest is in a different time zone" note; "This event has been changed" and "Updated invitation" subject lines in mail.
- Cancellation shows as "Cancelled: <title>" in the invite subject and the event vanishes or shows strikethrough for guests.

## 4. Common actions
- **Create event**: click a slot on the grid (default 30 or 60 min), type a title, Save. Adding guests triggers "Would you like to send invitation emails to Google Calendar guests?" with Send / Don't send / Back to editing.
- **Save on an edited event with guests**: prompts "Send update to guests?"; editing a recurring event asks "This event / This and following events / All events".
- **Delete event**: removes it; for guests it sends "Cancelled:" mail; organiser's event goes to the calendar Trash. Guests who delete only remove their own copy and silently decline.
- **RSVP**: Yes / No / Maybe at the bottom of the popup, "Yes, in a meeting room / Yes, joining virtually", with "Add a note" and **Propose a new time**.
- **Drag to move / drag the edge to resize**: changes start, end or duration immediately; with guests it asks to send an update.
- **Find a time / Suggested times**: shows overlapping free/busy of all guests and rooms; click a gap to set the time.
- **Colour** on a single event (right-click): often used as status in clinics (green = confirmed, yellow = unconfirmed, red = no-show, grey = cancelled) because Calendar has no status field of its own.
- **Duplicate**, **Copy to <calendar>**, **Publish event**, **Print**.
- **Appointment schedule > Share**: copies the booking page link or an embed; **Open booking page** shows what the client sees.
- **Add a secondary time zone** and **Event time zone** per event, so a 2:00 PM PT booking stops showing as 5:00 PM for the East-coast provider.
- **Set notifications** per event and per calendar; **Out of office** auto-declines new invites in that range.

## 5. Where mistakes happen
- Creating the booking on your own calendar instead of the provider's or room's calendar (the Calendar dropdown in the editor defaults to the signed-in user), so the provider never sees it and the room shows free.
- Editing one occurrence versus the whole series. "All events" moves every Tuesday appointment for a year; "This event" leaves the rest wrong. Read the dialog.
- Treating "Awaiting" as confirmed. The client never clicked Yes, the slot is unconfirmed, and the 24-hour reminder has not been acknowledged; chase before releasing the deposit rule.
- Zero buffer on a booking page: 30-minute services booked back to back with no clean-up or travel time; a 10-minute Buffer time and Maximum bookings per day cap are the defaults a seasoned scheduler sets.
- Time zone mismatches on a booking page shared across regions: the guest's slot shows in their zone, the calendar shows yours, and a 9:00 AM becomes 6:00 AM for the provider. Turn on the secondary time zone and check the event time zone field.
- Deleting an event to "cancel" a client appointment without sending the update, so the client still shows up; or clicking Send on an update that goes to 40 guests for a typo fix.
- Double-booking by hiding a calendar: the provider's calendar is unchecked in the left list, the grid looks empty, and a second event is dropped on top. Find a time shows all guests' busy blocks regardless.
- Relying on colour as status and forgetting to recolour: the event stays green after a cancellation phone call, so the next reader believes it is confirmed.
- Guests with "Modify event" permission dragging the appointment to a new time themselves, which changes it on the provider's calendar without anyone at the desk noticing.
