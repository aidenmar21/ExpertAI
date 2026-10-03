# Square Point of Sale

Square POS is the register app small retailers run on an iPad, Square Register, or Square Terminal; it rings sales, takes card payments, and handles refunds and exchanges against the original transaction.

## 1. What it is and who uses it

Square POS is a free register app tied to Square's card processing. The cashier uses it all day on the counter device; the owner or manager uses the Square Dashboard (web) for reporting, Items, team permissions, and refund approvals. For a retail-cashier-returns role, the screens that matter are Transactions (find the sale), the Refund flow (give money back), Items (what was sold and at what price), and Customers (who bought it, if they were attached). Square is common in bookstores, campus stores, coffee shops, boutiques, and anywhere with one to ten registers.

## 2. Main screens and objects

- **Checkout**: the sale screen. Item grid or Library on the left, current cart on the right, "Charge" button with the total.
- **Transactions**: the list of every completed payment at this location. Each row shows amount, time, tender type, last 4 of card, and a status badge. Open a row to see the receipt, items, and the "Issue Refund" button.
- **Items** (Item Library): products, variations, SKUs, prices, categories, modifiers. Also where "Gift Cards" live as an item type.
- **Customers** (Customer Directory): name, email, phone, notes, and "Transactions" history for anyone attached to a sale.
- **Reports**: Sales summary, Item sales, Refunds report by date.
- **Settings > Checkout**: cash drawer, tipping, signature, and "Refunds" settings including whether staff need a passcode to refund.
- **Objects**: Transaction (one payment), Receipt, Refund (always linked to a parent transaction), Item, Variation, Customer, Gift Card.

## 3. Field names and statuses you would see

- Transaction row: `Total`, `Tender` (Visa, Mastercard, Amex, Discover, Cash, Square Gift Card, Other), `Card ending in 1234`, `Receipt #` (short code like `AbC1`), `Time`, `Employee`.
- Transaction status badges: `Completed`, `Refunded`, `Partially Refunded`, `Voided`, `Pending`, `Failed`, `Declined`.
- Receipt detail: `Subtotal`, `Tax`, `Tip`, `Discount`, `Total`, `Paid with`, `Order #` or `Ticket name`, `Items` list with quantity and variation name.
- Refund screen: `Issue Refund`, `Refund amount`, `Refund items` (per-line checkboxes with quantity stepper), `Refund reason` (free text or picker: `Returned goods`, `Accidental charge`, `Canceled order`, `Fraudulent charge`, `Other`), `Refund to original payment method`, `Refund to Square Gift Card`, `Cash refund`, `Restock item` toggle.
- Refund status (in Transactions and Reports): `Refund pending`, `Refunded`, `Refund failed`, `Rejected`.
- Items screen: `Item name`, `Category`, `Variation`, `SKU`, `Price`, `Stock` (if inventory tracking is on), `Stock alert`.
- Customer card: `Name`, `Email`, `Phone`, `Groups`, `Notes`, `Total spent`, `Visits`, `First visit`, `Last visit`.
- Gift Card: `Gift card number`, `Balance`, `Load`, `Redeem`, `Check balance`.
- Permission prompt: `Enter passcode` with text like `Manager approval required to issue refund`.

## 4. Common actions

- **Find the sale**: Transactions > search by `Receipt #`, card last 4, amount, or scan the receipt barcode. Searching by last 4 only works for card tenders. Cash sales can only be found by amount and time.
- **Issue Refund**: opens the refund flow on that transaction. Choose `Refund items` (line-level) or `Refund amount` (a dollar figure). Line-level refund recalculates tax automatically; amount refund does not touch item lines.
- **Refund to original payment method**: default for card sales. Money goes back to the same card in 2-7 business days. Square allows this up to 1 year after the sale on most accounts; after that the button is grayed out.
- **Cash refund**: available for cash tenders, and as an override for card sales if the manager allows it. Opens the cash drawer and logs it against the drawer count.
- **Refund to Square Gift Card**: loads the refund onto a new or existing Square Gift Card. Sets the transaction status to `Refunded` and creates a gift card activity of type `Refund`.
- **Partial refund**: refund some items or part of the amount. Transaction status becomes `Partially Refunded`; the remaining refundable balance shows on the receipt.
- **Restock item** toggle: puts the quantity back into `Stock` for that variation. Off by default on some setups.
- **Exchange**: Square has no single exchange button. The standard is refund the old line to original payment method, then ring the new item as a fresh sale. Even exchanges still create two transactions.
- **Attach customer**: on the receipt, `Add customer` links the sale to a Customer Directory record so the return can be found by name later.
- **Void**: only for a sale that has not finished settling (same-day, before batch close). After settlement the option is `Issue Refund`, not void.

## 5. Where mistakes happen

1. **Refunding by amount instead of by item**: the dollar refund goes through, but the item line stays sold, inventory never restocks, and tax is not reversed line by line. Reports show the refund as a lump, and the manager cannot tell what was returned.
2. **Cash refund on a card sale**: the drawer comes up short against the card settlement, and the customer could also dispute the card charge and get paid twice. Default to `Refund to original payment method`.
3. **Searching the wrong location or device**: Transactions filters by location; a sale rung at the other register or store will not appear. Widen the location filter before telling the customer the receipt is not in the system.
4. **Refunding a gift card sale to a card**: a purchase paid with a Square Gift Card should refund back to the gift card. Refunding to a card or cash hands out real money for store credit.
5. **Missing the refund window**: after Square's refund limit (typically 1 year; some processors 120 days), the button is disabled. New hires keep retrying instead of switching to store credit or manager override.
6. **Double refund on a `Partially Refunded` sale**: the transaction is still open for the remaining balance, so a second cashier can refund the same item again. Check the receipt's refund history before issuing.
7. **Forgetting `Restock item`**: the toggle defaults off on many accounts. Stock counts drift and the item shows sold out when it is sitting on the returns shelf.
8. **Passcode sharing**: refunds above the configured limit prompt for a manager passcode. Cashiers borrowing the manager's code means every refund is logged under the manager's name and the audit trail is useless.
