# Accounts payable clerk, invoice approval

Checks every supplier invoice against the PO and the delivery before anyone pays it: right supplier, right amount, once, on time, booked to the right cost center.

## 1. Purpose and who the role serves

AP exists so the company pays for what it ordered and received, at the agreed price, exactly once. The clerk serves suppliers (paid on terms, so they keep shipping), budget owners (their spend lands on the right `cost_center`), the controller and auditors (every payment traceable to a PO, a delivery and an approval), and treasury (a predictable payment run). The clerk does not decide whether spend is wise; they decide whether it is real, approved, and unpaid.

## 2. Daily tasks

- Pull invoices from the AP mailbox, supplier portal and scanned mail; register `invoice_no`, `supplier`, `amount`, `currency`, `invoice_date`, `due_date`.
- Check `supplier_master`. Not in master data goes to vendor setup before anything else.
- Run the 3-way match: `po_number` exists, price and quantity agree, `delivery_note` is booked.
- Check `delivery_note_history` for Already paid before touching anything else.
- Code non-PO invoices to a GL account and `cost_center` and route to the right `approver`.
- Chase approvers whose queue is older than 5 business days so nothing misses terms.
- Put problem invoices On hold with a written reason and `request_info` from supplier or requester.
- Flag early-payment discounts (2/10 net 30) so the payment run captures them.
- Verify bank-detail change requests by call-back to the number already on file.
- Reconcile supplier statements monthly and support the GRNI accrual at month end.

## 3. Software and screens typically used

- **SAP accounts payable**: MIRO for invoice entry against a PO, FB60 for non-PO invoices, MIR4 to display, MIR7 for parked documents, FBL1N vendor line items, F110 payment proposal. The PO history tab shows goods receipts and earlier invoices per line.
- **QuickBooks** (smaller firms): Bills list, Enter Bill, link to Purchase Order, Pay Bills, Vendor Center with open balance and history.
- **Excel and Google Sheets**: the open-invoice aging, the tolerance exceptions log, statement reconciliations against the vendor ledger.
- **Gmail and Outlook**: the shared AP mailbox, one folder per status, approval emails kept as audit support. Nothing counts as approved until it is in the system.
- **Invoice workbench** (Coupa, Basware, SAP VIM or similar): one row per invoice carrying `po_match` (Matched | Mismatch | No PO), `delivery_note_history` (New | Already paid), `approver` and `status` (Open | Approved | On hold | Sent to controller | Rejected | Paid).

## 4. The standard workflow, step by step

1. Open the next Open invoice. Confirm it is an original invoice addressed to your legal entity, not a statement, quote or pro forma. Wrong entity: click `reject` with "re-issue to correct entity".
2. Check `supplier_master`. Not in master data: click `hold` and send to vendor setup for W-9 or VAT ID and a bank letter. Never create a vendor from an invoice.
3. Check for a duplicate: same `supplier` plus same `invoice_no`, or same `amount` and `invoice_date`. Normalize formats (INV-0042 vs 42) before calling it new.
4. Check `delivery_note_history`. Already paid: click `reject` as duplicate and note the earlier document number.
5. If `po_number` is present, run the 3-way match: invoice price and quantity against the PO, quantity against the `delivery_note`. Inside tolerance: `po_match` Matched. Outside: Mismatch, click `hold`, then `request_info` to purchasing with the exact variance.
6. If `po_match` is No PO, code the GL account and `cost_center` from the description, not from what the requester typed, and set `approver` to that cost center's budget owner.
7. Check approval authority: the `approver`'s limit must cover the full `amount` in its `currency`. Above their ceiling, click `send_to_controller`.
8. Check tax: VAT or sales tax rate, reverse charge on cross-border services, tax code per line.
9. Confirm `due_date` against the vendor master terms and flag any discount date to the payment run.
10. Click `approve`. Verify `status` reads Approved, attach PO, delivery note and approval email. Payment happens only through the scheduled run, never by a manual transfer from the desk.

## 5. Common judgment calls

- **Price is 1.5% over the PO.** Standard answer: inside the usual tolerance (2% or $50, whichever is lower), so approve as Matched and note the variance. At the limit or above, hold and ask purchasing to amend the PO. Tolerance absorbs rounding and freight, not renegotiation.
- **Invoice arrived, goods receipt not booked yet.** Standard answer: hold and ask receiving whether the delivery landed. Posting before the receipt is how you pay for things that never arrived.
- **Supplier emails new bank details with the invoice.** Standard answer: ignore the email for payment purposes. Call the supplier on the number in the vendor master, confirm, and have a second person approve the master change. Business email compromise is the single most expensive AP mistake.
- **Invoice is for $1,800 of laptops.** Standard answer: over the capitalization threshold (commonly $1,000 to $5,000) with a useful life over a year, so it is capex. It needs an asset number, not an office-supplies cost center.
- **Approver is on leave and the invoice is due Friday.** Standard answer: use the delegate configured in the system. If none, `send_to_controller`. Never approve on someone's behalf; a due date does not override the approval chain.
- **Two invoices from one supplier, each just under the approver's $5,000 limit, same day, same PO.** Standard answer: treat as a split. Send the pair to the controller together.
- **2/10 net 30 and the invoice is clean on day 6.** Standard answer: approve today and flag the discount date. 2% for paying 20 days early is roughly 36% annualized; losing it to a slow approver is a real cost.

## 6. Standard guardrails

- `amount` above the approver's ceiling (typical tiers: manager $5,000, director $25,000, controller $100,000, CFO above): `send_to_controller`, never approve.
- `po_match` is Mismatch and the variance is at or above 2% or $50: hold; only purchasing can change a PO.
- `supplier_master` is Not in master data: no approval and no payment until vendor setup completes with tax ID and verified bank details.
- `delivery_note_history` is Already paid: reject as duplicate, every time, even if the supplier insists.
- Any bank-detail change: call-back on the number on file plus dual approval. An email, a PDF letterhead or a portal message is not verification.
- `po_number` missing on a supplier that is normally on PO: `request_info`. Never guess a PO from history.
- Non-PO invoice over $500 with no named budget owner: hold until an `approver` is assigned. "No PO, no pay" applies above the petty threshold.
- Statement, quote, pro forma or reminder: never approve. Only an original invoice with an `invoice_no` gets posted.
- "Pay today" pressure from an executive address, especially for a new supplier or a wire: stop and verify by phone. Urgency is the fraud signature.

## 7. Mistakes new hires commonly make

- Approving a duplicate because the `invoice_no` format differed (INV-0042 vs 0042). The supplier is paid twice and recovery takes months.
- Updating bank details from an email that looked right. The next run wires to a fraudster and it is almost never recovered.
- Approving before the `delivery_note` exists. The order is short-shipped and you have already paid in full.
- Booking equipment to an expense `cost_center` to avoid the asset form. The fixed-asset register is wrong and depreciation is missed.
- Coding to whatever `cost_center` the requester asked for. Budget reports lie and the controller finds it at quarter end.
- Letting On hold invoices age with no `request_info` sent. The supplier stops shipping and the discount window closes.
- Treating an executive "urgent, please pay" email as approval. Approval lives in the system, not in the inbox.

## 8. Vocabulary

- **PO (purchase order)**: the approved order with price and quantity.
- **Goods receipt (GR)**: system confirmation that the goods arrived.
- **Delivery note**: the supplier's paperwork that travels with the goods.
- **3-way match**: invoice against PO against goods receipt.
- **2-way match**: invoice against PO only, used for services with no receipt.
- **Tolerance**: the variance allowed before an invoice blocks.
- **Park**: save an invoice without posting it.
- **Post**: book the invoice to the ledger.
- **Payment block**: a flag that keeps an invoice out of the run.
- **Payment run**: the scheduled batch that pays due approved invoices.
- **Net 30**: payment due 30 days from invoice date.
- **2/10 net 30**: 2% discount if paid within 10 days, otherwise net 30.
- **Vendor master**: the supplier record with tax ID, bank and terms.
- **Cost center**: the department that carries the cost.
- **GL account**: the general ledger account the spend posts to.
- **Capex / opex**: capital expenditure (asset) vs operating expense.
- **Credit note**: a supplier document reducing what is owed.
- **GRNI**: goods received not invoiced; the month-end accrual.
- **Segregation of duties**: the person who creates a vendor cannot approve or pay it.
- **BEC**: business email compromise, fraud through fake supplier or executive emails.
