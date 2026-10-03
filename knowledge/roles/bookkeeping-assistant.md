# Bookkeeping assistant

Records, categorizes, and reconciles a small business's transactions so the books match the bank, every dollar has a category and (where it matters) a receipt, and the owner and accountant can trust the numbers.

## 1. Purpose and who the role serves
The bookkeeping assistant keeps the ledger true: every transaction gets a payee and a category, every account ties to the bank statement to the penny each month, and anything personal, duplicated, or out of place is flagged, not buried. The role serves the owner (a P&L they can act on, no surprises at tax time), the outside accountant or CPA (clean, closed periods to file from), and vendors and staff (paid once, on time). The job is routine discipline plus knowing when to stop and ask.

## 2. Daily tasks
- Pull the bank and card feeds; match lines to existing entries, add the rest.
- Categorize new transactions: payee, category, account, class or job if tracked.
- Chase receipts over the receipt threshold; set receipt_attached.
- Flag anything that looks personal (personal_flag Yes) and route to the owner.
- Enter bills received; record payments against them.
- Apply customer payments to the right invoices; note unapplied cash.
- Check for duplicates: same payee, same amount, within a few days.
- Reconcile each bank and card account monthly (weekly if high-volume).
- Post recurring journal entries: depreciation, prepaid amortization, loan interest split.
- Prepare the month-end package: reconciliation reports, P&L, balance sheet, open-questions list.

## 3. Software and screens typically used
- **QuickBooks Online** (or Xero, Wave): the Bank transactions page (bank feed) with For review / Categorized / Excluded tabs; the Reconcile screen with statement ending balance, statement date, and the difference line; Chart of accounts; Bills and Expenses; Journal entry; Reports (P&L, Balance sheet, Reconciliation report, Audit log).
- **Transaction list**: a table with transaction_id, date, payee, amount, account, category, receipt_attached, reconciled, period_closed, personal_flag, approver, status (Uncategorized | Categorized | Flagged | Reconciled | Posted). Actions: categorize, reconcile, flag, post_journal, request_receipt.
- **Excel / Google Sheets**: the owner's open-questions list, reconciliation tie-outs, fixed-asset and prepaid schedules.
- **Gmail / Outlook**: receipt requests, vendor statements, owner questions. Receipt apps (Dext, Hubdoc) feed attachments.
- **Bank and card portals**: statement PDFs; the source of truth.

## 4. The standard workflow, step by step, done the right way
1. Open the bank feed. Check each line's date, payee, amount against open bills, invoices, or existing expenses. If one matches, click Match, not Add; Add creates a duplicate.
2. For a new transaction, set payee from the bank description (clean "SQ *JOES COFFEE" to Joe's Coffee), then category. Reuse the payee's last category unless the memo says otherwise.
3. Check amount. Over the receipt threshold (commonly $75; some firms use $25 or $50) with receipt_attached No: click request_receipt. Still categorize; the receipt doesn't block the books.
4. Check personal_flag. Grocery stores, personal clinics, streaming, kids' schools, round-number cash withdrawals: flag and route to the owner. Never guess "Meals" to make it go away.
5. Check period_closed. If the date is in a closed period, enter it on the first day of the open period with a memo, or ask the accountant.
6. Check for duplicates. Exclude the duplicate feed line with a memo.
7. Transfers between the business's own accounts: category Transfer, never income or expense. Owner paying personal bills from the business: Owner draw. Owner putting money in: Owner contribution.
8. Click categorize: status Uncategorized to Categorized.
9. Monthly reconciliation: open Reconcile, enter the statement ending balance and date from the statement PDF, tick each item on the statement, get the difference to exactly $0.00, then Finish and save the report. Ticked items get reconciled Yes.
10. Post journal entries only for items that don't flow through the bank (depreciation, accruals, reclasses), each with a memo and the approver's name.
11. Month-end: uncategorized count zero, every account reconciled, questions list to the owner, then tell the accountant the month is ready to close.

## 5. Common judgment calls
- **A $48 restaurant charge with no receipt.** Standard answer: under the $75 threshold, categorize as Meals with the bank record as support; note who and why if the owner can tell you. Over $75, chase the receipt.
- **Reconciliation is off by $0.12.** Standard answer: find it. It's a transposed digit or a bank fee not entered. Never post an adjustment to force zero.
- **Owner's Costco run: half groceries, half office supplies.** Standard answer: get the receipt and split, personal portion to Owner draw. No receipt: flag and ask.
- **A customer paid an invoice twice.** Standard answer: record the second payment as a customer credit, tell the owner, refund or apply to the next invoice per their call. Never book it as income.
- **A bill from last month arrives after the period closed.** Standard answer: enter it on the first day of the open period with memo "relates to [month]". If material (over roughly 5% of monthly expenses), tell the accountant first.
- **The owner pays themselves a round $5,000 and calls it salary.** Standard answer: for a sole proprietor or single-member LLC it's Owner draw, not payroll. For an S corp it must run through payroll with withholding; ask the accountant first.
- **A $3,200 equipment purchase.** Standard answer: fixed asset, not expense. Most small firms capitalize anything over $2,500 (the de minimis safe harbor). Code to Fixed assets, add to the asset schedule, leave depreciation to the accountant.

## 6. Standard guardrails
- Amount over $75 (or the firm's threshold), and any travel, lodging, or gift: receipt required. Chase twice, then put it on the owner's list.
- period_closed Yes: never enter, edit, or delete in a closed period; that changes a filed return. Corrections go to the accountant as a journal entry they approve.
- Journal entry over $1,000, or any entry hitting equity, loans, or fixed assets: approver must be the owner or accountant before post_journal.
- Reconciliation difference not $0.00: stop. Don't click Finish, don't post an adjustment. Find it or ask.
- personal_flag Yes: never a business expense, however small. Owner draw or ask.
- Unknown payee over about $500, or any unexplained outgoing transfer: confirm with the owner first. Fraud shows up here.
- Never delete transactions. Void or exclude with a memo so the audit log tells the story.
- Loan payments split into principal (balance sheet) and interest (expense). Sales tax collected and payroll withholdings are liabilities, never revenue or expense.
- Moving money is outside the role. Bank access is read-only; payments are the owner's action.

## 7. Mistakes new hires commonly make
- Clicking Add instead of Match in the bank feed, duplicating expenses and income.
- Coding transfers between checking and savings as income and expense, inflating both sides of the P&L.
- Posting a plug to make the reconciliation balance. The real error surfaces at tax time.
- Treating owner draws as salary or expense, so net income and equity are both wrong.
- Guessing a category to clear the Uncategorized list. Flagged is honest; a tidy wrong ledger is not.
- Expensing a $3,000 machine that should be capitalized, or capitalizing a $200 keyboard.
- Reconciling to the online bank balance instead of the statement ending balance. Online includes pending items.

## 8. Vocabulary
- **Bank feed**: transactions downloaded from the bank or card into the accounting system.
- **Match**: linking a feed line to an entry already in the books instead of adding a new one.
- **Reconciliation**: proving the books equal the bank statement for a period, difference $0.00.
- **Statement ending balance**: the closing balance printed on the bank statement; what you reconcile to.
- **Uncategorized**: a transaction with no category yet; status Uncategorized.
- **Chart of accounts**: the list of accounts the books are organized into.
- **Category**: the P&L or balance sheet account a transaction is coded to.
- **Owner draw**: money the owner takes for personal use; equity, not expense.
- **Owner contribution**: money the owner puts in; equity, not income.
- **Transfer**: movement between the business's own accounts; neither income nor expense.
- **Journal entry**: a manual debit-and-credit entry for items that don't flow through the bank.
- **Accrual**: recording an expense or revenue in the period it belongs to, before cash moves.
- **Closed period**: a month or year locked after review or filing; period_closed Yes.
- **Receipt threshold**: the amount above which a receipt is required, commonly $75.
- **De minimis safe harbor**: the rule letting small firms expense items under $2,500 rather than capitalize.
- **Fixed asset**: equipment or property capitalized and depreciated over time.
- **Unapplied payment**: customer cash received but not yet matched to an invoice.
- **Plug**: an adjustment entered only to force a balance; forbidden.
- **Audit log**: the system record of who changed what and when.
- **Month-end close**: the routine that reconciles every account and locks the period.
