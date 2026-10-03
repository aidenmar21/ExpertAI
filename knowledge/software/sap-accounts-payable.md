# SAP Accounts Payable (S/4HANA and ECC)

SAP's accounts payable module (FI-AP, with MM Logistics Invoice Verification) is where an AP clerk at a mid-size or large company enters supplier invoices against purchase orders, clears blocks, maintains vendor data, and runs the payment program.

## 1. What it is and who uses it

SAP ECC and S/4HANA share the same AP transaction codes, typed into the command field (`/nMIRO`) in SAP GUI, or opened as Fiori tiles ("Create Supplier Invoice", "Manage Supplier Line Items"). The accounts-payable-clerk uses MIRO for PO-based invoices, FB60 for non-PO invoices, ME23N and MIGO to check the PO and goods receipt, MRBR to release blocked invoices, XK03 or BP to look up the vendor, and F110 (usually run by a senior clerk or treasury) to pay. Document numbers are 10 digits; S/4HANA says "Supplier" where ECC says "Vendor", but clerks still say vendor.

## 2. Main screens and objects

- **MIRO (Enter Incoming Invoice)**: header on top with `Basic data`, `Payment`, `Details`, `Tax`, `Contacts`, `Note` tabs; item list below pulled from the PO; `Balance` traffic light top right (green = balanced, red = difference).
- **FB60 (Enter Vendor Invoice)**: non-PO invoice. Vendor header, G/L account lines with cost center or internal order.
- **ME23N (Display Purchase Order)**: PO header, item overview, item detail tabs including `Purchase Order History` (GR and IR documents), `Invoice` tab with `GR-Based IV` flag, `Delivery` tab.
- **MIGO (Goods Movement)**: goods receipt against PO; movement type `101`. Creates a material document.
- **MRBR (Release Blocked Invoices)**: list of invoices with payment block `R`, showing block reason columns.
- **XK03 / BP (Display Vendor / Business Partner)**: general data, company code data (`Reconciliation account`, `Payment terms`, `Payment methods`), purchasing data, bank details.
- **FBL1N / Manage Supplier Line Items**: open and cleared items per vendor.
- **F110 (Automatic Payment Transactions)**: parameters, proposal, payment run, payment medium.
- **FB03 / Display Document**: any posted FI document.
- **Objects**: Purchase order (PO), Goods receipt (material document, GR), Invoice document (MM, from MIRO), Accounting document (FI), Parked document, Vendor master / Business partner, Payment proposal, Payment document.

## 3. Field names and statuses you would see

- MIRO Basic data: `Transaction` dropdown (`Invoice`, `Credit memo`, `Subsequent debit`, `Subsequent credit`), `Invoice date`, `Posting date`, `Reference` (supplier's invoice number), `Amount`, `Currency`, `Tax amount`, `Calculate tax` checkbox, `Text`, `Company code`, `Baseline date`, `Payment terms`, `Payment block`, `Payment method`, `Invoicing party`.
- MIRO PO reference: `Purchase Order/Scheduling Agreement` field, `Delivery note`, `Bill of lading`, layout dropdown (`All information`, `Goods receipt`-based), item columns `Amount`, `Quantity`, `Order unit`, `Purchase order`, `Item`, `PO text`, `Tax code` (e.g. `V0`, `V1`), `Qty of goods received`, `GR Qty`, `Booking OK` checkbox.
- Balance indicator: `Balance 0.00 EUR` with green light; red light with a non-zero amount; yellow for within tolerance.
- Status messages at bottom: `Document no. 5105600123 created`, `Invoice document still contains messages`, `Document 5105600123 is blocked for payment`, `Price too high (tolerance limit of 2.00 % exceeded)`, `Quantity invoiced greater than goods receipt quantity`, `Enter a valid PO`, `Vendor 100234 not created in company code 1000`, `Check if invoice already entered under accounting doc. no. 5100012345`.
- Payment block values: `A` (Locked for payment), `R` (Invoice verification, set by system), `*` (Skip account), blank (Free for payment), plus custom like `P` (Pending approval).
- MRBR columns: `Blocking reason` with `Price` (`P`), `Quantity` (`Q`), `Date`, `Project`, `Manual`; checkboxes per line, buttons `Release`, `Release invoice`, `Cancel release`.
- Document status: `Parked`, `Posted`, `Held`, `Completed` (parked and ready for posting), `Reversed`.
- ME23N PO status tab: `Ordered`, `Delivered`, `Still to deliver`, `Invoiced`, `Still to be invoiced`, `Down payments`; item `Deletion indicator`, `Delivery completed` flag, `Final invoice` indicator.
- ME23N Purchase Order History: columns `Short text` with `WE` (goods receipt) and `RE-L` (invoice receipt) rows, `Material document`, `Quantity`, `Amount in LC`.
- MIGO header: `Goods Receipt` / `Purchase Order` selectors, `Document date`, `Posting date`, `Delivery note`, `Movement type 101`, `Storage location`, `Item OK` checkbox, status `Document 5000123456 posted`.
- Vendor master: `Supplier` / `Vendor` number, `Name`, `Search term`, `Country`, `Reconciliation acct` (e.g. `160000`), `Payment terms` (`Z030` = 30 days net), `Payment methods` (`T` transfer, `C` check), `Bank key`, `Bank account`, `IBAN`, `Alternative payee`, `Payment block` at master level, `Posting block`, `Deletion flag`, `Duplicate invoice check` (`Chk double inv.`) flag.
- F110 tabs: `Status`, `Parameter`, `Free selection`, `Additional log`, `Printout/data medium`; `Run date`, `Identification`, `Company codes`, `Payment methods`, `Next p/date`, `Vendor` range; status lines `Parameters have been entered`, `Payment proposal has been created`, `Payment run has been carried out`, `Posting orders: 25 generated, 25 completed`.
- FBL1N columns: `Document number`, `Doc. type` (`KR` vendor invoice, `KG` credit memo, `KZ` payment, `RE` MM invoice), `Posting date`, `Due date`, `Amount in local currency`, `Clearing document`, status icon red (open) or green (cleared), `Payment block` column.

## 4. Common actions

- **Post invoice (MIRO)**: enter PO number, hit Enter to pull items, enter `Amount` and `Reference`, check `Balance` is green, click `Post` (save icon). Creates an MM invoice document (51xxxxxxxx) and an FI document (19xxxxxxxx or 51xxxxxxxx). If outside tolerance, the system posts it with `Payment block R`.
- **Park (MIRO / FB60)**: `Hold` keeps a draft only you can see; `Park` (or `Save as completed`) creates a parked document number others can see and approve, with no accounting impact until posted via `FBV0` / `MIR4`.
- **Simulate**: shows the FI posting lines before saving. Use it when the tax or balance looks odd.
- **Three-way match**: SAP compares PO price and quantity, GR quantity, and invoice. With `GR-Based IV` on the PO item, the invoice cannot exceed received quantity. Differences inside tolerance (`PP` price, `DQ` quantity tolerance keys) post normally; outside, block `R`.
- **Release blocked invoice (MRBR)**: select the line, click `Release`. Clears block `R` so F110 can pick it up. Requires the clerk to have fixed the cause (new GR posted, price corrected on PO, or credit memo).
- **Display PO (ME23N)**: confirm vendor, price, `Still to be invoiced`, and in `Purchase Order History` whether a `WE` row exists before entering the invoice.
- **Goods receipt (MIGO)**: warehouse normally does this; AP looks at it. Movement type `101` receives, `102` reverses.
- **Credit memo**: MIRO with `Transaction: Credit memo` against the same PO, or FB65 for non-PO.
- **Reverse**: MR8M for an MM invoice (needs `Reversal reason`), FB08 for an FI document.
- **Payment run (F110)**: enter `Run date` and `Identification`, set parameters, `Proposal` then review the proposal log (`Exception list`), then `Payment run`. Creates `KZ` documents and clears the invoices.
- **Vendor lookup (XK03 / BP)**: check `Payment terms`, `Bank details`, `Payment block`, and that the vendor is extended to the company code.

## 5. Where mistakes happen

1. **Invoice before goods receipt**: with `GR-Based IV` set, MIRO shows `GR Qty 0` and the invoice either will not post or posts with block `R` for quantity. New hires post anyway and the invoice sits in MRBR for weeks.
2. **Duplicate invoice**: skipping the warning `Check if invoice already entered under accounting doc. no.` because the `Reference` was typed with a different spacing or a trailing letter. Two posted invoices, one paid twice if F110 runs before anyone notices.
3. **Wrong `Baseline date`**: it defaults to the posting date, not the invoice date; with `Z030` terms the vendor gets paid 2-3 weeks late, or an early-payment discount (`Cash discount 1`) is lost.
4. **Posting to the wrong company code or vendor**: the `Vendor 100234 not created in company code 1000` message means the supplier is not extended; the fix is a master data request, not picking a similar-looking vendor number.
5. **Releasing in MRBR without fixing the cause**: `Release` clears the block but does nothing to the price or quantity difference; the variance posts to the price difference account and nobody investigates.
6. **Parked document mistaken for posted**: a parked document number (also 51xxxxxxxx) looks like a posted one. Vendor calls about non-payment; the invoice was never posted and never reached F110.
7. **Tax code mismatch**: `Calculate tax` on with the wrong `Tax code` (`V0` instead of `V1`) throws the `Balance` red; clerks "fix" it by editing `Amount` instead of the tax code.
8. **Bank detail change by email**: changing `Bank account` or `Alternative payee` in the vendor master from an emailed request without callback verification is the classic payment-fraud path. The master change should be made only by master data, with four-eyes approval.
9. **Payment run with wrong `Next p/date`**: too early and invoices due next week are missed; too late and everything, including blocked-for-review items that were released by mistake, goes out in one run.
