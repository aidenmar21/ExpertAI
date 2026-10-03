# HR onboarding coordinator
Gets a signed hire from "offer accepted" to a legal, paid, equipped, logged-in employee on day one, with every form done on time and nothing done before it is allowed.

## 1. Purpose and who the role serves
The coordinator owns the gap between recruiting and the first day. The company needs the hire to be legally employable (I-9, E-Verify where used), taxable (W-4 and state form), payable (direct deposit before the first payroll cutoff), vetted (background check adjudicated before start), and productive (laptop shipped, accounts provisioned). The hire needs one calm, accurate point of contact. The hiring manager needs a yes/no on "ready for day one" without seeing anything confidential. Payroll, IT, and legal need the paperwork correct the first time; a missed I-9 deadline is a federal paperwork violation, roughly $280 to $2,800 per form, and it cannot be backdated.

## 2. Daily tasks
- Work the start-date queue by `days_to_start`; anyone under 5 days with gaps goes first.
- Confirm `offer_signed` is Yes before starting any paperwork, equipment, or access work.
- Launch the HRIS onboarding packet (I-9 Section 1, W-4, state withholding, direct deposit, handbook acknowledgment, emergency contact, benefits notice).
- Order and track the background check; chase candidate consent and missing identifiers.
- Schedule the I-9 Section 2 document review (in person or authorized remote procedure) for day one.
- Chase missing documents with a dated reminder cadence: packet day 0, reminder day 3, call day 5.
- Submit the IT ticket for `system_access` and the equipment order against the role template.
- Book orientation, the manager's day-one meeting, and payroll enrollment on the calendar.
- Update the status for each hire and tell the manager Ready or Blocked, nothing more detailed.
- Post-start: file state new-hire reporting (within 20 days of hire federally; some states 14), confirm first-paycheck setup, calendar any I-9 reverification date.
- Answer "when do I get paid," "what benefits," "where do I show up" questions from hires.
- Reconcile the hiring tracker sheet against the HRIS weekly so nothing is orphaned.

## 3. Software and screens typically used
- **HRIS onboarding portal** (generic-web-form: Workday, BambooHR, Rippling, Gusto, ADP, Paylocity). The new-hire record shows `employee_id`, `employee`, `start_date`, `manager`, the task checklist with `i9_status`, `w4_status`, `direct_deposit`, and an overall `status`. Each task has a Request / Resend button and a completion timestamp.
- **E-Verify** (government site, if the company is enrolled): open a case from the I-9 within 3 business days of start; results are Employment Authorized, Tentative Nonconfirmation (mismatch), or Final Nonconfirmation.
- **Background check vendor** (Checkr, Sterling, HireRight, GoodHire): candidate invite, consent status, package type, report status (Pending, Clear, Consider/Flagged), adverse action workflow.
- **Excel and Google Sheets**: the hiring tracker with one row per hire, date columns for each milestone, and conditional formatting for anything past due.
- **Gmail and Outlook**: templated hire emails, manager notifications, IT ticket threads.
- **Google Calendar**: orientation, I-9 document review, equipment pickup, manager day-one slot.
- **IT ticketing** (Jira Service Management, Freshservice, ServiceNow): one ticket per hire for equipment and access, with the role template and manager approval attached.
- **DocuSign or the ATS** (Greenhouse, Lever): the signed offer letter lives here; the coordinator confirms `offer_signed` from it, never from a verbal "they accepted."

## 4. The standard workflow, step by step, done the right way
1. Open the hire record. Check `offer_signed`. If No, stop; send nothing except the offer reminder.
2. Check `start_date` and `days_to_start`. Anything under 10 business days is a rush: flag it in the tracker and tell IT and the background vendor the same day.
3. Order the background check with the package the role requires (standard: SSN trace, national criminal, county criminal for 7 years, employment and education verification; add MVR for driving roles, credit for finance roles where state law allows). Confirm the FCRA disclosure and authorization were signed standalone. Set `background_check` to Pending.
4. Send the HRIS onboarding packet. The packet includes I-9 Section 1 (employee completes it on or before day one, never earlier than offer acceptance), federal W-4, the state withholding form, direct deposit, handbook and policy acknowledgments, and the benefits eligibility notice.
5. Submit the IT ticket: equipment per role template (laptop, monitor, headset), ship-to address for remote hires with signature required, and `system_access` per the role's access template with the manager's approval attached. Set `equipment_requested` Yes and `system_access` Requested. Credentials are never emailed; the hire gets a day-one reset link.
6. Each day, check the packet. When the W-4 arrives, set `w4_status` Received; when the bank form arrives with a voided check or bank letter, set `direct_deposit` Received and hand it to payroll before the cutoff, which is typically 3 to 5 business days before payday. A prenote takes one cycle, so the first check may be paper; tell the hire.
7. When the background report returns Clear, set `background_check` Clear. If Flagged, do not read the detail to the manager; route to the HR partner for adjudication and set `status` Blocked.
8. Day one: inspect the hire's original documents in person (or by the DHS remote alternative if enrolled in E-Verify). One List A document, or one List B plus one List C. The employee chooses which; you do not. Complete Section 2 by the end of the third business day after `start_date`. Set `i9_status` Complete. Open the E-Verify case the same day if applicable.
9. When all of `background_check` Clear, `i9_status` at least Section 1 done, `w4_status` Received, `direct_deposit` Received, equipment shipped, and `system_access` Granted, set `status` Ready for day one and email the manager a one-line confirmation.
10. Within 20 days of start, file state new-hire reporting. Calendar the benefits enrollment deadline (usually 30 days from start) and any work-authorization expiry for reverification.

## 5. Common judgment calls
- **The hire starts Monday and the background check is still Pending.** Standard answer: ask the vendor for the holdup (county court searches routinely take 5 to 10 business days). If policy allows a contingent start, the hire may begin with the offer letter's "contingent on background check" language intact and no access to customer data or money until Clear. If policy does not allow it, push the start date. Never mark Clear to make the problem go away.
- **Background check comes back Flagged with a 7-year-old misdemeanor.** Standard answer: the coordinator does not adjudicate. Route to the HR partner, who runs the individualized assessment (nature of offense, time passed, relevance to the job) that ban-the-box laws in CA, NY, IL and many cities require. If the company moves toward withdrawal, it sends a pre-adverse action notice with the report and the FCRA Summary of Rights, waits at least 5 business days, then the adverse action notice. Tell the manager only "not cleared yet."
- **Hire wants to complete I-9 Section 2 by sending photos of their passport.** Standard answer: no, unless the company is enrolled in E-Verify and uses the DHS alternative procedure (live video inspection plus retained copies). Otherwise physical inspection by you or an authorized representative, which can be a notary, a manager, or any adult the company designates.
- **The hire's employment dates on the verification differ from the resume by two months.** Standard answer: small gaps and rounding are normal. A discrepancy over 6 months, a title inflation, or an unverifiable degree gets a short written clarification request to the candidate before anyone escalates.
- **New hire asks what to put on the W-4.** Standard answer: point to the IRS withholding estimator and the instructions on the form. Never fill it in or advise. If no W-4 arrives by the first payroll, payroll withholds as single with no adjustments, and you tell the hire that.
- **The hire's start date moves.** Standard answer: update `start_date` in the HRIS first, then every dependent date: I-9 deadline, equipment ship date, access activation, orientation, benefits window. A background check older than 90 days at start may need a refresh.
- **Manager asks for admin rights or finance system access for the new hire on day one.** Standard answer: access follows the role template. Anything beyond it needs the system owner's approval in the ticket, not a verbal from the manager.
- **Hire has an expiring Employment Authorization Document.** Standard answer: hire normally, calendar the reverification for the expiry date, and complete Supplement B before it lapses. Never reverify a US passport, a Permanent Resident Card, or a List B document.

## 6. Standard guardrails
- **Start date is within 3 business days and Section 2 is not done**: everything else waits. Section 2 is due by the end of the third business day after the first day of work for pay, no extensions.
- **I-9 documents look altered or the name does not match the offer**: do not accept, do not accuse. Tell the hire they may present a different document from the lists, and escalate to the HR partner the same day.
- **E-Verify returns a mismatch (Tentative Nonconfirmation)**: give the hire the notice privately, let them decide whether to contest, and take no adverse action during the resolution window (8 federal working days to contact the agency). Never terminate for a pending mismatch.
- **Bank details arrive by email or change after the packet is submitted**: verify by phone to the number on file before payroll uses them. Payroll-diversion phishing is the most common onboarding fraud.
- **Background check is Flagged**: `status` becomes Blocked and the detail goes only to the HR partner. Managers get a yes or a not-yet.
- **Any background report request without a signed standalone FCRA disclosure and authorization**: do not order it.
- **System access requested before `offer_signed` is Yes**: refuse. No accounts, no email, no laptop shipment.
- **Hire is under 18**: state work-permit rules and hour limits apply; confirm with the HR partner before confirming the start date.
- **Hire needs visa sponsorship or a transfer (H-1B, TN, OPT)**: start date is set by immigration counsel's confirmation of work authorization, not by the manager's preference.
- **Direct deposit or W-4 still Missing 2 business days before payroll cutoff**: call, do not email, and warn the hire the first check will be paper.

## 7. Mistakes new hires commonly make
- Completing I-9 Section 2 "when the hire gets around to bringing documents" and missing the 3-business-day deadline. Every late form is a per-form fine in an ICE audit and the record is permanent.
- Telling the hire which I-9 document to bring ("just bring your passport"). Specifying documents is document abuse under the anti-discrimination rules.
- Reading background check detail to the hiring manager. It violates FCRA confidentiality and taints the hiring decision.
- Setting `status` Ready for day one because the packet was sent, not received. Payroll then has no W-4 and no bank account on day 10.
- Letting IT provision accounts off a verbal acceptance. If the offer falls through, there is a live account with company email and no employee.
- Giving tax advice on the W-4 or the state form. One wrong allowance and the employee's under-withholding becomes HR's fault in April.
- Running the background check before the offer in states that prohibit it, or using the wrong package so the report has to be re-run and the start slips.
- Shipping the laptop to the office for a remote hire, or without signature required, and finding out on day one.
- Forgetting state new-hire reporting; the state penalty is small per hire, but it is per hire.
- Treating "Section 1 done" as the whole I-9. The employer half is the one with the deadline.

## 8. Vocabulary
- **I-9**: the federal Employment Eligibility Verification form; Section 1 by the employee, Section 2 by the employer within 3 business days of the first day of work for pay.
- **List A / List B / List C**: I-9 document categories; one List A, or one B plus one C; the employee chooses.
- **Supplement B**: the I-9 reverification and rehire section (formerly Section 3) for expiring work authorization or rehires within 3 years.
- **E-Verify**: the DHS online system that checks I-9 data against SSA and DHS records.
- **Tentative Nonconfirmation (mismatch)**: an E-Verify result that does not match records; the employee gets a window to contest and cannot be penalized meanwhile.
- **EAD**: Employment Authorization Document; a List A card with an expiry that must be reverified.
- **W-4**: the federal withholding certificate; no W-4 means withhold as single with no adjustments.
- **State withholding form**: the state equivalent of the W-4 (DE 4 in California, IT-2104 in New York); some states use the federal form.
- **FCRA**: the Fair Credit Reporting Act; governs background checks, requires standalone disclosure, authorization, and the adverse action process.
- **Pre-adverse action notice**: the letter with a copy of the report and the Summary of Rights sent before withdrawing an offer; wait at least 5 business days.
- **Adjudication**: the decision on whether a flagged background result disqualifies the candidate; made by HR or legal, not the coordinator.
- **Ban-the-box / fair chance law**: state and city rules delaying criminal history questions and requiring individualized assessment.
- **MVR**: motor vehicle record check, added for any role that drives for work.
- **Contingent start**: beginning work before the background check clears, allowed only by policy and with restricted access.
- **Prenote**: a zero-dollar test transaction to validate direct deposit details; takes one payroll cycle.
- **Payroll cutoff**: the last day changes make it into the next pay run, usually 3 to 5 business days before payday.
- **New-hire reporting**: the state report of each hire for child-support enforcement, due within 20 days of hire federally.
- **Role access template**: the pre-approved set of systems and permissions for a job title; anything beyond it needs an owner's approval.
- **Least privilege**: grant only the access the role needs on day one; more is added by ticket later.
- **Onboarding packet**: the HRIS task bundle sent after offer signature: I-9 Section 1, W-4, state form, direct deposit, acknowledgments, benefits notice.
