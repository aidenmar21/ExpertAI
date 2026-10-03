# Excel and Google Sheets
Shared spreadsheets used as a work tool: the "tracker" that an office runs on when no system exists for the task, or when the system exists but nobody trusts it.

## 1. What it is and who uses it
Excel (desktop, or Excel for the web through OneDrive/SharePoint) and Google Sheets (browser, in Drive) are where bookkeepers keep the reconciliation, AP keeps the invoice log, HR keeps the onboarding checklist, and schedulers keep the provider roster. The same file is usually open by several people. The tracker pattern is always the same: one row per thing (invoice, new hire, appointment), one column per fact about it, a Status column driven by a dropdown, and conditional formatting that colours the row by that status. The spreadsheet is a system of record by accident, so the discipline lives in the people, not the tool.

## 2. Main screens and objects
- **Workbook / Spreadsheet**: the file. **Sheets (tabs)** along the bottom, e.g. `Tracker`, `Lookups`, `Archive`, `Pivot`, `Instructions`.
- **Header row**: row 1, usually bold with a fill colour and the view frozen under it (`View > Freeze > 1 row` in Sheets; `View > Freeze Panes` in Excel).
- **Table / Format as Table** (Excel) or a filtered range (Sheets): the filter arrows in each header cell.
- **Filter views** (Sheets) and **Custom views** / slicers (Excel): a saved filter per person so one person's filter does not hide rows for everyone.
- **Data validation** dropdowns: the small arrow in the cell; list sources are either typed in or a range on the `Lookups` tab.
- **Named ranges**, **Pivot tables**, **Charts**.
- **Comments / Notes** anchored to a cell (an orange or purple triangle in the corner).
- **Version history** (Sheets: `File > Version history > See version history`; Excel on SharePoint/OneDrive: `File > Info > Version History`).
- **Protected ranges / Protect sheet**: a lock icon or a greyed cell; editing gives "You're trying to edit a protected cell or range".
- **Share dialog**: Viewer / Commenter / Editor (Sheets); Can view / Can edit (Excel).

## 3. Field names and statuses you would see
Column headers on common trackers:
- AP invoice log: Invoice #, Supplier, Invoice Date, Due Date, Amount, Currency, PO #, PO Match, Received Date, Approver, Approved On, Paid On, Payment Ref, Status, Notes.
- Onboarding tracker: Employee ID, Employee Name, Start Date, Manager, Offer Signed, Background Check, I-9, W-4, Direct Deposit, Laptop Ordered, Email Account, Badge, Status, Owner, Last Updated.
- Bookkeeping reconciliation: Date, Payee, Memo, Amount, Account, Category, Receipt?, Cleared, Reconciled, Period, Flag, Reviewer.
- Scheduling roster: Date, Time, Provider, Client, Service, Duration, Room, Confirmed?, Deposit, Status, Notes.
Status dropdown values (whatever the team typed into validation, commonly): Open, In Progress, On Hold, Waiting, Done, Complete, Cancelled, N/A, Approved, Rejected, Paid, Yes, No, TBD, Blocked, Ready.
Conditional-format conventions: green fill = Done/Paid/Clear; yellow = In Progress/Waiting; red = Overdue/Blocked/Flagged; grey = Cancelled/N/A; red text for negative numbers or a past Due Date (`=B2<TODAY()`).
Cell-level signals a vision model will see: `#N/A` (a lookup found nothing), `#REF!` (a deleted referenced cell), `#VALUE!`, `#DIV/0!`, green triangle (number stored as text), `####` (column too narrow for a date or number), a small coloured cursor with a name (another editor in the cell), strikethrough text (someone's done convention), a filter funnel icon on a header (a hidden-rows filter is active), and row numbers that skip (hidden or filtered rows).
Formulas you will see in the formula bar: `=VLOOKUP(A2,Lookups!A:C,3,FALSE)`, `=XLOOKUP(A2,Lookups!A:A,Lookups!C:C,"Not found")`, `=INDEX/MATCH`, `=SUMIFS`, `=COUNTIF(Status,"Open")`, `=IF(TODAY()>D2,"Overdue","")`, `=IMPORTRANGE(...)` (Sheets), `=TEXT(A2,"yyyy-mm-dd")`.

## 4. Common actions
- **Type into the Status cell / pick from dropdown**: sets the value; the conditional format recolours the row immediately. A typed value that is not in the list shows a red corner marker (Sheets) or "The value you entered isn't valid" (Excel).
- **Filter** (funnel icon on the header): hides rows for everyone else in Sheets unless you create a **Filter view**; sort does the same and is harder to undo.
- **Insert row above/below** and **Delete row**: deletion is permanent for everyone; recoverable only through version history.
- **Fill down** (drag the small square at the corner of a cell): copies the formula with relative references; `$A$2` holds a reference.
- **Paste values only** (`Ctrl+Shift+V` in Sheets, Paste Special > Values in Excel): keeps numbers, drops formulas and formatting.
- **Protect range / Protect sheet**: locks header rows and formula columns so only named editors can change them; shows a warning or blocks outright.
- **Share**: sets Viewer, Commenter or Editor; a link set to "Anyone with the link" is a data-leak risk for anything with names and pay.
- **Comment and @mention**: assigns a task to a colleague by email; **Resolve** closes the thread.
- **Version history > Restore this version**: rolls the whole file back; `Name current version` before a bulk change.
- **Data > Remove duplicates**, **Text to columns**, **Find and replace** (with "Match entire cell contents" and "Also search within formulas" options).

## 5. Where mistakes happen
- Sorting a single column instead of the whole range: Invoice # stays put while Amount moves, and every row now describes a different invoice. Select all columns or use the header filter's sort.
- Filtering the shared sheet instead of a Filter view: colleagues see "their rows vanished" and start re-entering them, producing duplicates.
- Typing over a formula cell (the Days Overdue or Balance column) with a hard number; the cell looks right today and never updates again.
- `VLOOKUP` with the fourth argument left off (approximate match), returning the nearest wrong supplier; or looking up an ID stored as text against IDs stored as numbers, which gives `#N/A` for every row.
- Dates typed as text (`03/04/2026` read as 4 March in one locale and 3 April in another); the Due Date formula then flags nothing. Check the cell is right-aligned as a true date.
- Pasting a block from email or another sheet that overwrites the dropdown validation and the conditional formatting on those rows.
- Deleting a row to "clean up" a cancelled item; the Archive tab, the pivot, and anyone who referenced the row by number lose it. Set Status to Cancelled instead.
- Editing the live tracker when you meant the copy, or the copy when you meant the live one; always read the tab name and file title before changing status.
- Sharing with Editor instead of Viewer, or leaving the link open to the whole domain on a file with salaries or bank details.
