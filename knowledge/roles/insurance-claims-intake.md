# Insurance claims intake specialist
Takes the first notice of loss, verifies the policy was in force on the loss date, captures the facts once and accurately, sets the right first status, and routes to the right adjuster or to SIU, without ever promising coverage.

## 1. Purpose and who the role serves
Intake is the front door of claims. The insured or claimant needs to be heard, told what happens next, and told what to do tonight (stop the leak, tow the car, keep receipts). The adjuster needs a clean loss description, correct dates, working contact details, and documents already requested. The carrier needs state acknowledgment deadlines met (10 to 15 days in most states), reserves in the right range, and fraud indicators caught at the door. Intake records; it does not decide coverage, liability, or value.

## 2. Daily tasks
- Take FNOL by phone, web form, email, and agent referral; create the record and issue the `claim_no`.
- Verify caller identity and relationship to the policy (named insured, listed driver, third party, attorney, public adjuster).
- Confirm `policy_status` and that the policy was in force on `loss_date`, not just `report_date`.
- Capture loss facts: date, time, location, what happened, injuries, other parties, witnesses, police agency and report number.
- Set `loss_type`, enter `estimated_amount` and the `deductible` from the declarations.
- Request photos, police report, estimates, receipts; set `status` Pending documents while waiting.
- Run ISO ClaimSearch or CLUE and record `prior_claims_12m`.
- Screen for red flags, record `fraud_flags`, refer to SIU when indicators stack.
- Assign by line, severity, and territory; fast-track small, clean claims.
- Send the acknowledgment letter with the claim number the same day.

## 3. Software and screens typically used
- **Claims system** (generic-web-form: Guidewire ClaimCenter, Duck Creek, or homegrown): the FNOL wizard walks policy lookup, loss details, parties, documents. The claim summary shows `claim_no`, `policy_no`, `policy_status`, `claimant`, `loss_date`, `report_date`, `days_to_report`, `loss_type`, `estimated_amount`, `deductible`, `police_report`, `photos_received`, `prior_claims_12m`, `fraud_flags`, `status`, with buttons for open_claim, assign_adjuster, request_docs, refer_siu, deny.
- **Salesforce** (Service Cloud or Financial Services Cloud): policyholder record, call logging, case history, scripts, and the callback and document-chase task queue; the finished FNOL is pushed to the claims system.
- **ISO ClaimSearch / CLUE**: industry claim history by person, VIN, and address; also catches the same loss filed with two carriers.
- **Gmail and Outlook**: acknowledgment letters and document request templates; attachments go into the claim, never stay in the mailbox.

## 4. The standard workflow, step by step, done the right way
1. Identify the caller and verify with two data points (policy number plus date of birth or address) before discussing anything.
2. Look up `policy_no`, read the declarations, confirm `policy_status`. Check effective and expiration dates against the `loss_date` the caller gives. If the loss falls in a lapse, keep going; note it and let coverage decide.
3. Record `loss_date` and `report_date`; the system fills `days_to_report`. Over 14 days, ask why and type the answer verbatim.
4. Take the loss description in the caller's words. Do not lead ("so the other car ran the light?"). Ask about injuries first on any auto or premises claim.
5. Set `loss_type`. Enter the `deductible` from the declarations, including percentage wind/hail deductibles.
6. Record `police_report`: Yes with agency and number, No with the reason, N/A for losses that do not call for one (interior water, appliance failure). Theft, vandalism, or hit-and-run with No goes into `fraud_flags`.
7. Enter `estimated_amount` from the reserve guide, not the caller's guess: glass 500, minor collision 3,500, moderate collision 8,000, total loss at ACV, interior water 8,000 to 15,000, kitchen fire 40,000 plus, bodily injury 25,000 per claimant until an adjuster evaluates.
8. Run the prior-claims check and record `prior_claims_12m`. Three or more in 12 months, or a prior claim on the same item or room, gets a note.
9. Set `fraud_flags`. One soft indicator is a note; two hard indicators, or one hard plus pressure for fast cash, means refer_siu after opening.
10. Click open_claim and give the `claim_no`. Click request_docs; set `status` Pending documents if anything essential is outstanding, otherwise Open.
11. Assign: desk fast-track for property under 5,000 or auto under 2,500 with photos, no injury, clean coverage; field adjuster for anything structural, any injury, any dispute; large-loss unit over 100,000. Set `status` Assigned.
12. Tell the caller who will call and when (within 1 business day), what to send, and what to do tonight. Send the acknowledgment. Log the call in Salesforce.

## 5. Common judgment calls
- **Policy lapsed for non-payment and the loss happened 6 days into the lapse.** Standard answer: open the claim and route to coverage. Grace periods run 10 to 30 days for auto and about 10 for homeowners depending on state and carrier, and reinstatement timing matters. Intake never denies on `policy_status`; a wrong denial at the door is a bad-faith exposure.
- **Loss was 90 days ago and is only now reported.** Standard answer: take it. Late notice supports denial only when it prejudiced the investigation, and in most states the carrier must prove that. Record the reason, flag it if the story does not explain it, let the adjuster evaluate.
- **Damage is probably below the deductible.** Standard answer: explain how the deductible works and that the claim may close without payment, then let the insured decide. Never talk them out of filing. Comprehensive glass may carry a lower or zero deductible in some states.
- **A third party calls to claim against your insured.** Standard answer: open a liability claim with them as `claimant`; no `deductible` applies to them. Take their facts, do not discuss your insured's coverage or fault, call the insured for their side the same day.
- **Caller already has an attorney.** Standard answer: take basic facts, get the firm's name, stop. No recorded statement, no settlement talk; all contact goes through counsel.
- **Stolen vehicle, both keys in hand, no police report, asks how fast a check can be cut.** Standard answer: open, request the police report, refer to SIU. Three hard indicators. Tell the caller the file is "under review" and never say SIU.
- **Loss 12 days after inception, or a week after coverage was increased on the exact item damaged.** Standard answer: open and refer. Losses within 30 to 60 days of inception or an endorsement are the top SIU indicator, but many are legitimate; referral is a review, not an accusation.

## 6. Standard guardrails
- **Any coverage question from the caller**: "I will record that and the adjuster will confirm coverage after reviewing the policy." Intake never confirms coverage, estimates the payout, or apportions fault.
- **`days_to_report` over 30**: record the reason in the caller's words and flag it. Over 365, or past the policy's suit-limitation period (commonly 1 to 2 years for property), escalate to a supervisor before assigning.
- **`policy_status` Lapsed or Cancelled on the loss date**: open and route to coverage. Deny is a supervisor or coverage action with a written letter citing policy language, never an intake click.
- **Any injury, fatality, or claim over 100,000**: notify the supervisor the same day; assign to field or large-loss; never fast-track.
- **Two or more hard fraud indicators** (theft with no police report, loss within 30 days of inception or endorsement, prior loss on the same item, inconsistent loss date, all keys present, handwritten receipts for high-value contents, pressure for immediate cash, a recurring attorney-and-clinic pairing): refer_siu after opening. Never tell the caller.
- **Caller asks to change `loss_date` after hearing the policy dates**: do not edit. Record both dates and the request itself; this is a hard indicator.
- **Attorney or public adjuster represents the claimant**: no recorded statement, no settlement discussion.
- **Caller is in danger** (fire burning, water still flowing, injured on scene): emergency services first, the 24-hour mitigation vendor second, the claim third.

## 7. Mistakes new hires commonly make
- Denying at intake because `policy_status` reads Lapsed. Grace period, reinstatement date, and loss date decide coverage; a wrongful denial starts a bad-faith suit.
- Saying "you're covered" on the first call. The caller writes it down and the complaint goes to the state insurance department when the adjuster walks it back.
- Entering `report_date` as the loss date because the caller was unsure. `days_to_report` is now wrong and late-notice analysis is lost.
- Telling the insured to discard the carpet or repair the car before inspection. The adjuster can no longer evaluate cause or value.
- Setting `estimated_amount` from the caller's number. "Maybe 500" for a burst pipe has not seen the subfloor; reserves drive assignment.
- Fast-tracking a light-damage collision with a soft-tissue injury. Low impact plus injury is the classic staged-accident pattern and belongs with a casualty adjuster.

## 8. Vocabulary
- **FNOL**: first notice of loss; the first report of a claim and the record intake creates.
- **Named insured**: the policy owner on the declarations who makes first-party claims.
- **Claimant**: whoever claims payment; first-party is the insured, third-party claims against the insured's liability coverage.
- **Declarations page**: the policy summary of coverages, limits, deductibles, property, drivers, and dates.
- **Policy period**: inception to expiration; the loss date must fall inside it.
- **Grace period**: days after a missed premium when coverage continues, typically 10 to 30.
- **Lapse**: the coverage gap after the grace period ends and before reinstatement.
- **Reinstatement**: restoring a lapsed policy, sometimes with a gap before payment posted.
- **Endorsement**: a mid-term policy change, such as adding a vehicle or scheduled jewelry.
- **Deductible**: the insured's share per claim; a flat amount or a percentage of Coverage A for wind, hail, or hurricane.
- **Reserve**: the carrier's estimate of what the claim will cost, set at intake and refined by the adjuster.
- **ACV**: actual cash value; replacement cost minus depreciation; the basis for a total loss.
- **RCV**: replacement cost value; paid on many property policies once repairs are done.
- **Proof of loss**: the sworn statement of the claim amount; starts the prompt-pay clock.
- **Reservation of rights**: the adjuster's letter saying the carrier is investigating without admitting coverage.
- **Subrogation**: recovering what the carrier paid from the at-fault party; how a not-at-fault insured gets the deductible back.
- **SIU**: special investigations unit; a referral is a review, not an accusation.
- **ISO ClaimSearch / CLUE**: industry databases of prior claims by person, VIN, and address.
- **CAT code**: the catastrophe number for a declared storm or wildfire so claims are grouped and fast-tracked.
- **Mitigation**: the insured's duty to prevent further damage; emergency mitigation costs are usually covered.
