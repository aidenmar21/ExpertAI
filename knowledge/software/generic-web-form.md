# Generic web form (internal browser-based system)
Any in-house or vertical system used through a browser: a hotel PMS (Opera, Cloudbeds, Mews), an HRIS (Workday, BambooHR, ADP), a claims system (Guidewire ClaimCenter, Duck Creek), a returns portal, or a home-grown admin tool. They look different and behave the same.

## 1. What it is and who uses it
Every desk role has at least one of these. The vendor changes, the pattern does not: a list of records, a record detail page with a form, a status that moves through a fixed set of values, buttons that either save a draft or submit the record to the next step, and a history tab that shows who changed what. A front-desk agent sees it as the reservation screen, an HR coordinator as the employee profile, a claims clerk as the claim file, a cashier as the return request. Knowing the pattern lets a trainer read an unfamiliar screen in a few seconds: find the record identifier, find the status, find the required fields, find Save and Submit, find History.

## 2. Main screens and objects
- **Login** page, then a **Dashboard / Home** with tiles or counts ("12 arrivals today", "5 claims pending documents", "3 returns awaiting approval").
- **Record list** (also called grid, worklist, queue, index, register): a table with one row per record, a search box above it, filter chips or a filter sidebar, column headers that sort, a row count ("Showing 1-25 of 143"), pagination, and a "New" / "Create" / "+" button.
- **Record detail**: a header strip with the identifier (Reservation #, Employee ID, Claim #, RMA #), the primary name, the Status badge, and action buttons; below it either a long form or tabs: Details / Summary, Financials / Folio, Documents / Attachments, Notes / Comments, Tasks, History / Audit trail / Activity log, Related records.
- **Form sections** (collapsible panels or a left-hand step list in a wizard: Step 1 of 4).
- **Modal dialogs** for confirmations ("Are you sure you want to cancel this reservation?"), for sub-records (Add payment, Add dependent, Add line item), and for reasons (Reason code required).
- **Lookup / typeahead fields** with a magnifying glass icon that open a search popup for Guest profile, Employee, Policy, Order.
- **Toast / banner messages** at the top or corner: green "Saved", red "Validation failed", yellow "Unsaved changes".
- **User menu** with role, property/entity switcher, and "Switch to <property>" or "Acting as".

## 3. Field names and statuses you would see
Common across systems:
- Identifier labels: ID, Reference, Ref #, Record #, Confirmation #, Reservation #, Employee ID, Claim #, Order #, RMA #, Case ID, Ticket #.
- Form markers: red asterisk `*` next to a required label, "Required" or "(required)" text, red border and inline message "This field is required", greyed-out or padlocked read-only fields, a lock icon beside a field that needs higher permission, "Read only" tag, a calendar icon on date pickers (dd/mm/yyyy or mm/dd/yyyy placeholder), currency fields with a fixed symbol, percent fields, Yes / No toggles, radio buttons, multi-select chips, and "Other (please specify)" with a text box that appears.
- Status badges (coloured pills): Draft, New, Submitted, Pending, Pending Approval, In Review, Approved, Rejected, On Hold, Active, Inactive, Open, Closed, Cancelled, Completed, Archived, Void, Expired, Locked, Awaiting Documents, Returned for correction.
- Owner / assignment labels: Assigned to, Owner, Agent, Adjuster, Handler, Approver, Created by, Last modified by, Last modified on, Created on, Due date, SLA, Age (days).
- PMS flavour: Guest Name, Arrival, Departure, Nights, Adults/Children, Room Type, Room No., Rate Code, Rate, Balance, Deposit, Payment Method, Card on File, ID Verified, Loyalty Number / Tier, Special Requests, Traces, Status: Reserved, Due In, Checked In, In House, Due Out, Checked Out, No Show, Cancelled, Waitlist.
- HRIS flavour: Employee ID, Legal Name, Preferred Name, Hire Date, Start Date, Job Title, Department, Manager, Location, Employment Type (Full-time, Part-time, Contractor), Pay Rate, Pay Group, Work Email, Onboarding Tasks (Not Started, In Progress, Completed), I-9 Section 1 / Section 2, E-Verify Status, W-4, Direct Deposit, Background Check (Pending, Clear, Consider), Status: Pre-hire, Onboarding, Active, On Leave, Terminated.
- Claims flavour: Claim Number, Policy Number, Policy Status (In Force, Lapsed, Cancelled), Insured, Claimant, Loss Date, Reported Date, Loss Cause, Loss Location, Exposure, Reserve, Deductible, Adjuster, SIU Referral, Documents Received, Status: New, Open, Pending Documents, Assigned, Under Investigation, Referred, Approved, Denied, Closed, Reopened.
- Returns portal flavour: RMA #, Order #, Customer, Item / SKU, Reason (Changed mind, Damaged, Defective, Wrong item), Condition (New, Opened, Damaged), Purchase Date, Days Since Purchase, Refund Method (Original payment, Store credit, Exchange), Restocking Fee, Status: Requested, Approved, Received, Inspected, Refunded, Store Credit Issued, Exchanged, Denied, Awaiting Manager.

## 4. Common actions
- **Save** / **Save draft**: writes the record without moving its status; validation usually runs only on fields you touched. **Save and close** returns to the list.
- **Submit** / **Submit for approval** / **Complete** / **Check in** / **Finalize**: runs full validation, moves status forward, often locks the record and notifies the next owner. This is the irreversible one.
- **Cancel** (the button next to Save discards edits; the Cancel in the action menu cancels the record itself and usually asks for a reason code).
- **Approve / Reject / Return for correction / Send back**: approval-step buttons that set Status and write a History row with the approver and comment.
- **Assign / Reassign / Take ownership / Claim**: sets Assigned to.
- **Add note / Add comment**: internal, timestamped, usually cannot be edited after save; some have a "Visible to customer" checkbox.
- **Upload / Attach**: adds to Documents; shows file name, size, uploaded by, and sometimes a Document Type picker (ID, Receipt, Police report, Signed offer).
- **Search** (global box, often by identifier or name; wildcards `*` or `%` in older systems) and **Filters** (Status = Open, Assigned to = Me, Date range), **Saved views / My queue**, **Export to CSV / Excel**, **Print / PDF**.
- **History / Audit trail** tab: rows of Date, User, Field, Old value, New value, Action; read it before touching a record someone else was in.
- **Edit** (pencil) toggles fields from read-only to editable; **Unlock / Reopen** needs a supervisor role.

## 5. Where mistakes happen
- Clicking Submit when Save was meant: the record advances to the approver, locks, and has to be sent back for correction with a History row that shows the mistake. Look at the button label and colour; Submit is usually the filled primary button on the right.
- Clearing a validation error by putting junk in the required field ("N/A", "0", today's date, "Other") so the form will accept it. Downstream reports and rules now run on fake data.
- Working on the wrong record: two guests named Garcia, two claims from the same policy, the previous employee still open in another tab. Read the identifier in the header strip before every change.
- Editing a record that is already Closed, Checked Out, Terminated or Approved through a reopen, which triggers reversal entries, re-approval or a re-sent notification nobody wanted.
- Losing an hour of entry because the session timed out (15 to 30 minutes idle is typical) or the browser Back button was used inside a wizard; save drafts at each step.
- Choosing the first typeahead match (the wrong Policy, Order or Guest profile with a similar name) and attaching the record to the wrong parent; the lookup popup shows more columns than the dropdown for exactly this reason.
- Date picker locale: 04/05 entered as 4 May on a system expecting mm/dd gives an April 5 arrival or loss date, and nothing warns you.
- Typing a customer-visible note into the Notes field with "Visible to customer" ticked by default, or putting internal commentary in Description, which prints on the confirmation or letter.
- Filtering the list to "Assigned to = Me" and forgetting it, so new unassigned records in the queue go unseen all shift.
- Uploading a document without setting Document Type, so the "Documents Received" checklist stays unticked and the status sits in Pending Documents.
