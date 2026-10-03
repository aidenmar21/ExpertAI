# HR onboarding coordinator
Gets a signed hire from "offer accepted" to a legal, paid, equipped, logged-in employee on day one, with every form done on time and nothing done before it is allowed.

## 1. Purpose and who the role serves
The coordinator owns the gap between recruiting and the first day. The company needs the hire legally employable (I-9, E-Verify where used), taxable (W-4 and state form), payable (direct deposit before payroll cutoff), vetted (background check adjudicated), and productive (laptop shipped, accounts provisioned). The hire needs one calm, accurate contact. The manager needs a yes or no on "ready for day one" without seeing anything confidential. A missed I-9 deadline is a federal paperwork violation, roughly $280 to $2,800 per form, and cannot be backdated.

## 2. Daily tasks
- Work the queue by `days_to_start`; anyone under 5 days with gaps goes first.
- Confirm `offer_signed` is Yes before any paperwork, equipment, or access work.
- Launch the HRIS packet: I-9 Section 1, W-4, state withholding, direct deposit, acknowledgments, benefits notice.
- Order and track the background check; chase consent and missing identifiers.
- Schedule the day-one I-9 Section 2 document review.
- Chase missing documents: packet day 0, reminder day 3, call day 5.
- Submit the IT ticket for `system_access` and equipment against the role template.
- Update each hire's `status`; tell the manager Ready or Blocked, nothing more.
- Post-start: file state new-hire reporting, confirm first paycheck, calendar any I-9 reverification date.

## 3. Software and screens typically used
- **HRIS onboarding portal** (generic-web-form: Workday, BambooHR, Rippling, Gusto, ADP): the new-hire record with `employee_id`, `employee`, `start_date`, `manager`, a task checklist showing `i9_status`, `w4_status`, `direct_deposit`, and overall `status`; each task has a Resend button and a completion timestamp.
- **E-Verify** (if enrolled): case opened from the I-9 within 3 business days of start; results are Employment Authorized, Tentative Nonconfirmation, or Final Nonconfirmation.
- **Background check vendor** (Checkr, Sterling, HireRight): invite, consent, package, report status (Pending, Clear, Consider), adverse action workflow.
- **Excel and Google Sheets**: the hiring tracker, one row per hire, a date column per milestone, past-due highlighted.
- **Gmail and Outlook**: templated hire emails, manager notices, IT ticket threads.
- **Google Calendar**: orientation, document review, manager day-one slot.
- **DocuSign or the ATS** (Greenhouse, Lever): the signed offer; `offer_signed` is confirmed here, never from a verbal.

## 4. The standard workflow, step by step, done the right way
1. Open the hire record. If `offer_signed` is No, stop; send only the offer reminder.
2. Check `days_to_start`. Under 10 business days is a rush: flag it and tell IT and the background vendor today.
3. Order the background check with the role's package (SSN trace, national and 7-year county criminal, employment and education verification; MVR for drivers). Confirm the standalone FCRA disclosure and authorization were signed. Set `background_check` Pending.
4. Send the HRIS packet. I-9 Section 1 is completed by the employee on or before day one, never before offer acceptance.
5. Submit the IT ticket: equipment per template, signature-required shipping for remote hires, `system_access` per the role template with manager approval. Set `equipment_requested` Yes and `system_access` Requested. Credentials are never emailed; the hire gets a day-one reset link.
6. Check the packet daily. W-4 in: `w4_status` Received. Bank form with voided check or bank letter in: `direct_deposit` Received, handed to payroll before cutoff (3 to 5 business days before payday). A prenote takes one cycle, so warn the hire the first check may be paper.
7. Background Clear: set `background_check` Clear. Flagged: route to the HR partner, set `status` Blocked, tell the manager only "not cleared yet."
8. Day one: physically inspect original documents (or the DHS remote alternative if E-Verify enrolled). One List A, or one List B plus one List C; the employee chooses. Complete Section 2 by the end of the third business day after `start_date`; set `i9_status` Complete; open the E-Verify case the same day.
9. When `background_check` is Clear, `w4_status` and `direct_deposit` Received, equipment shipped, and `system_access` Granted, set `status` Ready for day one and send the manager a one-line confirmation.
10. Within 20 days of start, file state new-hire reporting. Calendar the 30-day benefits enrollment deadline and any work-authorization expiry.

## 5. Common judgment calls
- **Start is Monday and the background check is still Pending.** Standard answer: ask the vendor what is holding it (county searches routinely take 5 to 10 business days). If policy allows a contingent start, the hire begins under the offer's contingency language with no access to customer data or money until Clear. Otherwise push the start date. Never mark Clear to make the problem go away.
- **Background check returns Flagged with a 7-year-old misdemeanor.** Standard answer: you do not adjudicate. The HR partner runs the individualized assessment (nature, time passed, job relevance) that fair chance laws in CA, NY, IL and many cities require. If the offer may be withdrawn: pre-adverse action notice with the report and FCRA Summary of Rights, wait at least 5 business days, then the adverse action notice.
- **Hire wants to do Section 2 by sending passport photos.** Standard answer: no, unless the company is E-Verify enrolled and uses the DHS alternative procedure (live video plus retained copies). Otherwise physical inspection by you or an authorized representative, which can be a notary or any adult the company designates.
- **Hire asks what to put on the W-4.** Standard answer: point to the IRS withholding estimator and the form instructions. Never advise. No W-4 by the first payroll means withholding as single with no adjustments; tell the hire that.
- **Start date moves.** Standard answer: change `start_date` in the HRIS first, then every dependent date: I-9 deadline, ship date, access activation, benefits window. A background check older than 90 days at start may need a refresh.
- **Manager wants admin or finance system rights on day one.** Standard answer: access follows the role template; anything beyond it needs the system owner's approval in the ticket.
- **Hire has an expiring Employment Authorization Document.** Standard answer: hire normally, calendar the reverification, complete Supplement B before expiry. Never reverify a US passport, Permanent Resident Card, or List B document.

## 6. Standard guardrails
- **Start within 3 business days and Section 2 not done**: everything else waits. Section 2 is due by the end of the third business day after the first day of paid work, no extensions.
- **I-9 documents look altered or the name does not match the offer**: do not accept, do not accuse. The hire may present a different listed document; escalate to the HR partner the same day.
- **E-Verify mismatch**: give the notice privately, let the hire decide whether to contest, take no adverse action during the 8 federal working days they have to respond.
- **Bank details arrive by email or change after submission**: verify by phone to the number on file before payroll uses them. Payroll-diversion phishing is the most common onboarding fraud.
- **Background check Flagged**: `status` Blocked; detail goes only to the HR partner.
- **No signed standalone FCRA disclosure and authorization**: do not order the report.
- **Access or equipment requested before `offer_signed` is Yes**: refuse.
- **Hire needs visa sponsorship or transfer (H-1B, TN, OPT)**: the start date is set by immigration counsel's confirmation of work authorization, not the manager.

## 7. Mistakes new hires commonly make
- Doing Section 2 "when the hire brings documents" and missing the 3-business-day deadline. Every late form is a per-form fine in an ICE audit.
- Telling the hire which document to bring ("just bring your passport"). Specifying documents is document abuse under the anti-discrimination rules.
- Reading background detail to the hiring manager. It breaches FCRA confidentiality and taints the decision.
- Marking Ready for day one because the packet was sent, not received. Payroll has no W-4 and no bank account on payday.
- Letting IT provision accounts off a verbal acceptance. If the offer collapses there is a live company account with no employee.
- Treating "Section 1 done" as the whole I-9. The employer half carries the deadline.

## 8. Vocabulary
- **I-9**: Employment Eligibility Verification; Section 1 by the employee, Section 2 by the employer within 3 business days of the first day of paid work.
- **List A / B / C**: I-9 document categories; one A, or one B plus one C; the employee chooses.
- **Supplement B**: the I-9 reverification and rehire section (formerly Section 3).
- **E-Verify**: the DHS system that checks I-9 data against SSA and DHS records.
- **Tentative Nonconfirmation**: an E-Verify mismatch the employee may contest; no penalty while pending.
- **EAD**: Employment Authorization Document; a List A card with an expiry that must be reverified.
- **W-4**: federal withholding certificate; none on file means withhold as single with no adjustments.
- **State withholding form**: the state W-4 equivalent (DE 4 in California, IT-2104 in New York).
- **FCRA**: Fair Credit Reporting Act; governs background check disclosure, authorization, and adverse action.
- **Pre-adverse action notice**: the letter with the report and Summary of Rights sent before withdrawing an offer; wait at least 5 business days.
- **Adjudication**: deciding whether a flagged result disqualifies the candidate; HR or legal, not the coordinator.
- **Fair chance law**: ban-the-box rules delaying criminal history questions and requiring individualized assessment.
- **MVR**: motor vehicle record check for any role that drives.
- **Contingent start**: working before the background check clears, by policy only, with restricted access.
- **Prenote**: a zero-dollar test deposit validating bank details; takes one payroll cycle.
- **Payroll cutoff**: last day changes make the next pay run, usually 3 to 5 business days before payday.
- **New-hire reporting**: the state report of each hire for child-support enforcement, due within 20 days.
- **Role access template**: the pre-approved systems and permissions for a job title.
- **Least privilege**: grant only what the role needs on day one; add by ticket later.
- **Onboarding packet**: the HRIS task bundle sent after offer signature.
