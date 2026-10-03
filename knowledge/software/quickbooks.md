# QuickBooks Online

QuickBooks Online (QBO) is the web-based ledger most small businesses keep their books in; the bookkeeper lives in the Bank feed, Reconcile, and Bills screens, and everything they do lands in the Chart of accounts.

## 1. What it is and who uses it

QBO is Intuit's cloud accounting product (Simple Start, Essentials, Plus, Advanced). A bookkeeping-assistant uses it daily to categorize bank transactions, match deposits to invoices, enter and pay bills, attach receipts, and reconcile accounts at month end. An accounts-payable-clerk at a small company uses the Bills and Vendors screens and the Pay bills run. The owner or outside accountant sets the Closing date, approves journal entries, and reviews reports. The desktop product (QuickBooks Desktop) has different screens; this file covers Online.

## 2. Main screens and objects

- **Dashboard** / **Business overview**: cash flow widgets, bank balances, open invoices.
- **Transactions > Bank transactions** (the "Bank feed"): one tab per connected account with `For review`, `Categorized`, and `Excluded` sub-tabs. This is where most of the day goes.
- **Transactions > Reconcile**: pick an account, enter `Ending balance` and `Ending date` from the statement, tick transactions until `Difference` is 0.00.
- **Expenses > Bills** and **Expenses > Vendors**: bills entered, bills due, vendor list with open balances.
- **Expenses > Expenses**: non-bill spend (checks, expenses, credit card charges).
- **Sales > Invoices**, **Customers**: receivables side.
- **Settings (gear) > Chart of accounts**: every account with `Type`, `Detail type`, `QuickBooks balance`, `Bank balance`.
- **+ New > Journal entry**: debits and credits by line.
- **Settings > Advanced > Accounting > Close the books**: `Closing date` and optional password.
- **Reports**: Profit and Loss, Balance Sheet, Accounts payable aging, Reconciliation reports, Audit log.
- **Objects**: Bank transaction, Expense, Check, Bill, Bill payment, Vendor, Customer, Invoice, Deposit, Transfer, Journal entry, Account, Attachment.

## 3. Field names and statuses you would see

- Bank feed row: `Date`, `Description`, `Payee`, `Category or Match`, `Spent`, `Received`, `Memo`, `Action` with `Add`, `Match`, `View`, `Confirm`, `Review`, `Transfer`.
- Bank feed sub-tabs: `For review` (with a count badge), `Categorized`, `Excluded`. Row hints: `1 record found`, `2 records found`, `Rule applied`, `Suggested`, `Matched`.
- Bank feed detail (expanded row): `Vendor/Customer`, `Category`, `Tags`, `Billable`, `Customer`, `Class`, `Location`, `Memo`, `Add attachment`, `Split` button, `Exclude` link, `Find match` link, `Transfer` toggle.
- Bill form: `Vendor`, `Mailing address`, `Terms` (`Net 30`, `Net 15`, `Due on receipt`), `Bill date`, `Due date`, `Bill no.`, `Category details` lines (`Category`, `Description`, `Amount`, `Billable`, `Customer`), `Item details` lines, `Memo`, `Attachments`, `Total`.
- Bill status (Bills list): `Open`, `Overdue`, `Paid`, `Partially paid`, `Scheduled`. Column `Balance due`, `Due date`, `Status`.
- Pay bills screen: `Payment account`, `Payment date`, `Starting check no.`, per-row `Open balance`, `Credit applied`, `Payment` amount, `Total payment amount`.
- Vendor card: `Company name`, `Display name as`, `Email`, `Phone`, `Billing address`, `Terms`, `Account no.`, `Business ID No. / Tax ID`, `Track payments for 1099` checkbox, `Open balance`, `Overdue balance`. Vendor status `Active` / `Inactive`.
- Chart of accounts columns: `Name`, `Type` (`Bank`, `Accounts receivable (A/R)`, `Other Current Assets`, `Fixed Assets`, `Credit Card`, `Accounts payable (A/P)`, `Equity`, `Income`, `Cost of Goods Sold`, `Expenses`, `Other Expense`), `Detail type`, `QuickBooks balance`, `Bank balance`, `Action` (`View register`, `Run report`, `Edit`, `Make inactive`).
- Reconcile screen: `Account`, `Beginning balance`, `Ending balance`, `Ending date`, `Service charge`, `Interest earned`; working view shows `Statement ending balance`, `Cleared balance`, `Difference`, tabs `Payments`, `Deposits`, `All`, and per-row checkbox with `R` (reconciled) or `C` (cleared) in the register.
- Journal entry: `Journal date`, `Journal no.`, lines with `Account`, `Debits`, `Credits`, `Description`, `Name`, `Is Adjusting Journal Entry?` checkbox, `Memo`, `Total` debit and credit must equal.
- Close the books: `Closing date`, `Close the books` toggle, `Allow changes after viewing a warning` vs `Allow changes after viewing a warning and entering password`, `Password`.
- Register and Audit log entries: `Reconciled`, `Deleted`, `Voided`, `Edited`, `Added`, with user and timestamp.
- Transaction attachments: paperclip icon, `Attachments (1)`.

## 4. Common actions

- **Add** (bank feed): creates a new Expense or Deposit from the feed row with the chosen `Category` and `Payee`. Row moves to `Categorized`.
- **Match**: links the feed row to an existing QBO transaction (an invoice, bill payment, or manually entered expense). Prevents duplicates; the existing transaction gets its cleared flag.
- **Confirm**: accepts a `Suggested` or `Rule applied` category. Same effect as Add.
- **Find match**: search by date range and amount when QBO did not auto-find the record.
- **Split**: divides one feed row across several categories or customers.
- **Exclude**: hides the row (duplicate feed line, personal charge on a business card that will be reimbursed). Does not create a transaction.
- **Transfer**: books the row as a move between two balance-sheet accounts, not income or expense.
- **Enter bill**: creates a Bill with `Open` status and increases Accounts payable. Pay later from `Pay bills` or `Mark as paid`.
- **Pay bills**: creates Bill payment transactions, sets bills to `Paid` or `Partially paid`, reduces the `Payment account`.
- **Reconcile**: ticking rows marks them `C`; `Finish now` when `Difference` is 0.00 marks them `R` and generates a Reconciliation report. `Save for later` keeps progress.
- **Undo reconciliation**: accountant-user only, from the reconciliation history.
- **Journal entry**: posts manual debits and credits; used for accruals, depreciation, corrections.
- **Set Closing date**: locks transactions dated on or before it; edits prompt a warning or password.
- **Make inactive** (account or vendor): hides it; cannot delete an account with a balance.
- **Receipt capture**: Transactions > Receipts, upload or email a receipt; QBO reads it and offers `Review` then `Create expense` or match.

## 5. Where mistakes happen

1. **Add instead of Match**: a customer payment already recorded against an invoice gets added again from the feed as a deposit to Sales. Income doubles and the invoice stays open. Check for `1 record found` before clicking Add.
2. **Transfer booked as expense**: a credit card payment from checking categorized to an expense account instead of `Transfer` to the credit card account inflates expenses and leaves the card balance wrong.
3. **Reconciling with a forced balance**: entering an adjusting entry so `Difference` hits 0.00 instead of finding the missing transaction. QBO books it to `Reconciliation Discrepancies` and the next month is worse.
4. **Editing a reconciled transaction**: changing the amount or account on a row marked `R` breaks the beginning balance for the next reconcile. The warning dialog is easy to click through.
5. **Dating a transaction before the Closing date**: a late receipt entered with its original date lands in a closed period; with only the warning (no password) set, the P&L the accountant already filed on changes silently.
6. **Bill entered and expense also added**: the vendor bill is entered under Bills, then the bank feed payment is categorized as an expense instead of matched to the bill payment. The bill stays `Open`, A/P is overstated, and expense is doubled.
7. **Wrong Detail type on a new account**: creating an account with `Type: Expenses` for something that is really `Cost of Goods Sold` or an asset. Reports group it wrong and fixing it later means reclassing history.
8. **Vendor duplicates**: `Amazon`, `Amazon.com`, and `AMZN Mktp` as three vendors. 1099 tracking, aging, and rules all fragment. Merge by renaming `Display name as` to match.
9. **No attachment**: categorizing without `Add attachment` leaves `receipt_attached` effectively No; the auditor or accountant will ask for it months later.
