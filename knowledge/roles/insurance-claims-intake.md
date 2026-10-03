# Insurance claims intake specialist
Takes the first notice of loss, verifies the policy was in force on the loss date, captures the facts once and accurately, sets the right first status, and routes the claim to the right adjuster or to SIU, without ever promising coverage.

## 1. Purpose and who the role serves
Intake is the front door of the claims department. The insured or claimant needs to be heard, told what happens next, and told what to do tonight (stop the leak, get the car towed, keep the receipts). The adjuster needs a file with a clean loss description, correct dates, contact details that work, and the documents already requested, so the first call is about the claim and not about typos. The carrier needs state-mandated acknowledgment deadlines met (10 to 15 days in most states under the Unfair Claims Settlement Practices rules; California 15 calendar days, New York 15 business days, Texas 15 days), reserves set in the right range, and the 10 percent of claims with fraud indicators caught at the door rather than after payment. Intake records; it does not decide coverage, liability, or value.

## 2. Daily tasks
- Take FNOL by phone, web form, email, and agent referral; create the claim record and issue the `claim_no`.
- Verify caller identity and relationship to the policy (named insured, listed driver, third-party claimant, attorney, public adjuster).
- Confirm `policy_status` and that the policy was in force on `loss_date`, not just on `report_date`.
- Capture loss facts: date, time, location, what happened, injuries, vehicles or property involved, other parties, witnesses, police agency and report number.
- Set `loss_type`, record `estimated_amount` and the applicable `deductible` from the declarations page.
- Request documents: photos, police report, repair estimates, receipts, proof of ownership; set `status` Pending documents while waiting.
- Run the prior-claims check (ISO ClaimSearch or CLUE) and record `prior_claims_12m`.
- Screen for red flags and record `fraud_flags`; refer to SIU when the indicators stack up.
- Assign to the right desk or field adjuster by line, severity, and territory; fast-track small, clean claims.
- Send the acknowledgment letter and the claim number the same day.
- Give immediate-steps guidance: mitigation, rental, tow, emergency board-up, keep damaged items.
- Call back agents and insureds who left messages; update contact details and preferred language.

## 3. Software and screens typically used
- **Claims system** (generic-web-form: Guidewire ClaimCenter, Duck Creek Claims, or a carrier's homegrown system). The FNOL wizard walks policy lookup, loss details, parties, exposures, and documents. The claim summary shows `claim_no`, `policy_no`, `policy_status`, `claimant`, `loss_date`, `report_date`, `days_to_report`, `loss_type`, `estimated_amount`, `deductible`, `police_report`, `photos_received`, `prior_claims_12m`, `fraud_flags`, and `status`, with action buttons for open_claim, assign_adjuster, request_docs, refer_siu, and deny.
- **Salesforce** (Service Cloud or Financial Services Cloud): the customer and policyholder record, call logging, case history, the knowledge base of scripts, and the task queue for callbacks and document chases. Many carriers run intake in Salesforce and push the finished FNOL to the claims system.
- **Policy administration system**: the declarations page with coverages, limits, deductibles, inception and expiration dates, listed drivers and vehicles, scheduled property, mortgagee or lienholder.
- **ISO ClaimSearch / CLUE**: industry claim history by person, VIN, and address; the source for `prior_claims_12m` and for spotting the same loss reported to two carriers.
- **Gmail and Outlook**: acknowledgment letters, document request templates, agent correspondence; attachments get uploaded to the claim, never left in the mailbox.
- **Telephony with recording** (Five9, Genesys, Amazon Connect): recorded statements must be announced and consented to at the start.

## 4. The standard workflow, step by step, done the right way
1. Identify the caller: name, callback number, email, and relationship to the policy. Verify with two data points from the policy (policy number plus date of birth or address) before discussing anything.
2. Look up `policy_no` and read the declarations. Confirm `policy_status`. Check the effective and expiration dates against the `loss_date` the caller gives. If the loss falls in a lapse or after cancellation, keep going; note it and let coverage decide later.
3. Record `loss_date` and `report_date`; the system computes `days_to_report`. Ask what caused any delay over 14 days and type the answer verbatim.
4. Take the loss description in the caller's words. Who, what, where, when, how. Do not lead ("so the other car ran the light?"). Ask about injuries first on any auto or premises claim.
5. Set `loss_type`. For auto: collision, comprehensive, theft, glass, liability. For property: water, wind/hail, fire, theft, liability. Enter the `deductible` from the declarations, including percentage wind/hail deductibles.
6. Record `police_report`: Yes with agency and number, No with the reason, or N/A for losses that do not call for one (interior water, appliance failure). Theft, vandalism, and hit-and-run without a police report go in `fraud_flags`.
7. Enter `estimated_amount` from the caller's description. Use the carrier's reserve guide, not the caller's guess: glass 500, minor collision 3,500, moderate collision 8,000, total loss by ACV, interior water 8,000 to 15,000, kitchen fire 40,000 plus, bodily injury 25,000 per claimant until an adjuster evaluates.
8. Run the prior-claims check and record `prior_claims_12m`. Three or more in 12 months, or a prior claim for the same item or room, gets a note.
9. Review the red-flag list and set `fraud_flags`. One soft indicator is a note; two hard indicators, or one hard plus the caller pushing for fast cash, means refer_siu after opening.
10. Click open_claim and give the `claim_no`. Click request_docs for photos, receipts, the police report, and estimates; set `status` Pending documents if anything essential is outstanding, otherwise Open.
11. Assign: fast-track desk adjuster for property under 5,000 or auto under 2,500 with photos, no injury, and clean coverage; field adjuster for anything structural, any injury, or any dispute; large loss unit over 100,000. Set `status` Assigned.
12. Tell the caller the next steps in plain words: who will call, within how long (typically 1 business day, 24 to 48 hours), what to send, and what to do tonight. Send the acknowledgment letter. Log the call in Salesforce.

## 5. Common judgment calls
- **The policy lapsed for non-payment and the loss happened 6 days into the lapse.** Standard answer: open the claim anyway and route it to coverage. Many states and carriers have a grace period (10 to 30 days for auto, 10 days common for homeowners) and reinstatement with a lapse may still cover it depending on when payment posted. Intake never denies on `policy_status`; a wrong denial at the door is a bad-faith exposure.
- **The loss was 90 days ago and is only now being reported.** Standard answer: take it. "Prompt notice" conditions let the carrier deny only when late notice prejudiced its investigation, and in most states the carrier must prove that. Record why it was late, set `fraud_flags` if the story does not explain it, and let the adjuster evaluate.
- **The damage is probably below the deductible.** Standard answer: explain how the deductible works and that the claim may close without payment, then let the insured decide whether to file. Never talk them out of it. If they file, open it; it is their claim history and their choice. Flag that a comprehensive glass claim may carry a lower or zero deductible in some states.
- **A third party calls to claim against your insured.** Standard answer: open it as a liability claim with the third party as `claimant`; no `deductible` applies to them. Take their facts and contact details, do not discuss your insured's coverage or fault, and tell them an adjuster will contact them. Call the insured for their side the same day.
- **The caller says they already have an attorney.** Standard answer: take basic facts, get the attorney's name and firm, and stop. No recorded statement, no settlement talk. All further contact goes through counsel; note it prominently on the file.
- **Caller reports a stolen vehicle, has both keys, no police report, and asks how fast a check can be cut.** Standard answer: open the claim, request the police report, and refer to SIU. Theft without a police report, possession of all keys, and pressure for speed are three hard indicators. Tell the caller the file is "under review" and never say SIU.
- **Loss occurred 12 days after the policy started, or a week after coverage was increased on the exact item damaged.** Standard answer: open and refer. Losses in the first 30 to 60 days of a policy or right after an endorsement are the top SIU indicator, but many are legitimate; referral is a review, not an accusation.
- **A named storm hit the area and the insured calls with roof damage.** Standard answer: tag the claim with the catastrophe (CAT) code, apply the wind/hail deductible (often 1 to 2 percent of Coverage A, not the flat 1,000), assign to the CAT team, and tell the insured to get a tarp up and keep the receipt.
- **Water has been running under the sink for weeks and there is mold.** Standard answer: open it, but note long-term seepage and mold are commonly excluded or sub-limited (5,000 to 10,000 mold cap). Do not say "excluded"; say the adjuster will review the policy terms.

## 6. Standard guardrails
- **Any coverage question from the caller**: say "I will record that and the adjuster will confirm coverage after reviewing the policy." Intake never confirms coverage, never estimates the payout, and never apportions fault.
- **`days_to_report` over 30**: record the reason in the caller's words and flag it. Over 365 days, or past the policy's suit-limitation period (commonly 1 to 2 years for property), escalate to a supervisor before assigning.
- **`policy_status` Lapsed or Cancelled on the loss date**: open and route to coverage; never click deny from intake. Deny is a supervisor or coverage counsel action with a written letter citing policy language.
- **Any injury, fatality, or claim over 100,000**: notify the supervisor the same day and assign to the field or large-loss unit; do not fast-track.
- **Two or more hard fraud indicators** (no police report on a theft, loss within 30 days of inception or endorsement, prior loss on the same item, inconsistent loss date, all keys present on a stolen vehicle, handwritten receipts for high-value contents, claimant pushing for immediate cash, same attorney-and-clinic pairing seen on other files): refer_siu after opening. Never tell the caller about the referral.
- **The caller asks to change `loss_date` after hearing about the policy dates**: do not edit. Record both dates and the request itself as a note; this is a hard indicator.
- **Attorney or public adjuster represents the claimant**: no recorded statement, no settlement discussion; direct everything through the representative.
- **Mortgagee or lienholder on the declarations**: they are listed on any property or total-loss payment; tell the insured the check will have two names.
- **Caller is distressed or in danger** (fire still burning, injured on scene, water still flowing): emergency services first, mitigation second, claim third. Give the 24-hour mitigation vendor number.
- **Recorded statement**: announce the recording, get verbal consent on tape, and never record a minor or a represented party.

## 7. Mistakes new hires commonly make
- Denying at intake because `policy_status` says Lapsed. The grace period, the reinstatement date, and the loss date decide coverage, and a wrongful denial is the start of a bad-faith suit.
- Saying "you're covered" or "that should be paid" on the first call. The caller writes it down; the adjuster then has to walk it back and the complaint goes to the state insurance department.
- Entering `report_date` as the loss date because the caller was not sure. `days_to_report` is now wrong and the late-notice analysis is lost.
- Leading the caller through the story so it fits a covered cause. The recorded statement contradicts the photos and the file ends up in SIU for the wrong reason.
- Skipping the ISO ClaimSearch check because the claim is small. The same water loss claimed twice under two policies is caught by that one search.
- Telling the insured to throw out the damaged carpet or get the car repaired before the adjuster sees it. The adjuster now has no way to evaluate cause or value.
- Setting `estimated_amount` from the caller's number. A homeowner who says "maybe 500" for a burst pipe has not seen the subfloor; reserves drive assignment and reporting.
- Giving a time frame like "a check in a week." State prompt-pay rules give the carrier 15 to 30 days after proof of loss, and the adjuster has not inspected yet.
- Fast-tracking a claim with a soft-tissue injury because the vehicle damage is light. Low-impact plus injury is the classic staged-accident pattern and belongs with a casualty adjuster.
- Leaving the police report number out because the caller "will send it later." It never arrives, and theft and hit-and-run claims stall for weeks.

## 8. Vocabulary
- **FNOL**: first notice of loss; the first report of a claim and the record intake creates.
- **Named insured**: the person or business on the declarations page who owns the policy and can make first-party claims.
- **Claimant**: whoever is claiming payment; a first-party claimant is the insured, a third-party claimant is someone claiming against the insured's liability coverage.
- **Declarations page**: the policy summary listing coverages, limits, deductibles, insured property, drivers, and dates.
- **Policy period**: the inception to expiration dates; the loss date must fall inside it for coverage.
- **Grace period**: days after a missed premium during which coverage continues, typically 10 to 30 depending on line and state.
- **Lapse**: the gap in coverage after a grace period ends and before any reinstatement.
- **Reinstatement**: restoring a lapsed policy, sometimes with a lapse in coverage for the days before payment posted.
- **Endorsement**: a mid-term change to the policy, such as adding a vehicle or scheduled jewelry.
- **Deductible**: the amount the insured bears per claim; a flat dollar amount or a percentage of Coverage A for wind, hail, or hurricane.
- **Reserve**: the carrier's estimate of what the claim will cost, set at intake and refined by the adjuster.
- **ACV**: actual cash value; replacement cost minus depreciation; the basis for a total-loss vehicle payment.
- **RCV**: replacement cost value; what it costs to replace with like kind and quality, paid on many property policies once repairs are done.
- **Proof of loss**: the sworn statement of the claim amount; starts the state prompt-pay clock.
- **Reservation of rights**: the adjuster's letter saying the carrier is investigating without admitting coverage.
- **Subrogation**: the carrier recovering what it paid from the at-fault party, which is how a not-at-fault insured gets the deductible back.
- **SIU**: the special investigations unit that reviews suspected fraud; a referral is a review, not an accusation.
- **ISO ClaimSearch / CLUE**: industry databases of prior claims by person, VIN, and address.
- **CAT code**: the catastrophe number assigned to a declared storm or wildfire event so claims are grouped and fast-tracked.
- **Mitigation**: the insured's duty to take reasonable steps to prevent further damage; emergency mitigation costs are usually covered.
