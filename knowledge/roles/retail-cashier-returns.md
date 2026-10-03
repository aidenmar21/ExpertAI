# Retail cashier, returns desk

Takes back books, textbooks, merch and electronics at the returns counter, pays out only what the store owes, and knows exactly when to stop and call the manager.

## 1. Purpose and who the role serves

The returns desk is where the store keeps a customer without giving away money it does not owe. Three people are served at once: the customer at the counter (a fast, fair answer), the store (margin, shrink and fraud), and the shift manager, who carries the risk on every exception. A good returns cashier knows the written policy cold, knows which parts bend and by how much, and never keys a refund they cannot explain at the end of the shift.

## 2. Daily tasks

- Count the opening float against the till slip and sign the count sheet.
- Look up original sales by `receipt_no`, last 4 of the card, phone number or email.
- Inspect every returned `item`: shrink-wrap, spine, pages, tags, seals, serial numbers, scratch-off panels.
- Set `condition` honestly (New | Opened | Damaged | Defective) before deciding anything.
- Process refunds to the original tender, store credit, and even or price-difference exchanges.
- Handle textbook returns against the add/drop calendar, including the access-code rule.
- Route damaged and defective stock: back to the floor, damage-out, or return to vendor.
- Log no-receipt returns with the customer's ID in the returns portal.
- Call the manager for overrides and anything over your limit; leave `status` at Waiting for manager until they act.
- Close the drawer: count down, record over/short, drop the deposit.

## 3. Software and screens typically used

- **Square POS**: Transactions list, transaction detail with "Issue Refund", refund amount and reason, "Refund to original payment method" vs gift card. Lookup by card last 4 or receipt number.
- **Shopify POS**: Orders list, order detail, Return / Exchange flow, restock toggle per line, refund method (original payment, store credit, gift card), customer profile with order history.
- **Returns portal** (a web form): one record per return with `receipt_no`, `customer`, `item`, `item_type`, `price`, `purchase_date`, `days_since_purchase`, `condition`, `payment_method`, `refund_method`, `status`. For no-receipt returns it scans the ID and returns Approved, Warning or Denied.
- **Manager override**: a PIN or badge swipe on the POS that unlocks refunds over the cashier limit.

## 4. The standard workflow, step by step

1. Get the item on the counter and ask why it is coming back. Do not touch the register until you have seen the goods.
2. Ask for the receipt. None? Ask for the card used, then phone or email. Search the POS by `receipt_no`, card last 4 or customer and open the original transaction.
3. Confirm `item`, `price` as actually paid after discounts, `purchase_date` and `payment_method` from the sale, not from what the customer says.
4. Check `days_since_purchase` against the window for the `item_type`: book 30, merch 30, electronics 14, textbook until the add/drop deadline (typically 7 to 14 days from term start), textbook_access_code 0 once opened.
5. Inspect and set `condition`. Books: no creased spine, no writing. Textbooks: shrink-wrap intact, code panel unscratched. Electronics: seals unbroken, serial matches the box and the sale.
6. Decide the outcome. If anything is outside your authority (amount, window, condition, portal result), click `call_manager`, set `status` to Waiting for manager and stop.
7. Choose `refund_method`: Original card for card, Cash for cash, Store credit for gift_card, gift receipts and no-receipt returns.
8. Click `refund`, `store_credit` or `exchange` from inside the original transaction (a linked return). Never key a blind refund when the sale can be found.
9. Hand over the return receipt. For card refunds say "3 to 10 business days to show on your statement".
10. Tag the item with the reason and bin it: sellable, damaged or defective/RTV. Confirm `status` reads Refunded, Store credit issued, Exchanged or Denied, never left Open.

## 5. Common judgment calls

- **No receipt, but it is clearly our stock.** Standard answer: look up by card or phone first. If no sale is found, store credit at the lowest selling price in the last 90 days, ID scanned into the portal, never cash. The portal decides velocity; you do not.
- **Textbook returned shrink-wrapped three days after the add/drop deadline.** Standard answer: deny at the counter and offer buyback. Once enrollment settles the store cannot resell that book to the course. Only a manager extends the window, usually only for a documented dropped class.
- **Bundled textbook with the access code scratched.** Standard answer: no refund on the bundle. The code is the value and it is spent. If the book itself is unopened, a manager may refund the book portion only.
- **Receipt shows card, customer wants cash.** Standard answer: no. Card refunds go back to the same card. Cash-for-card is the standard laundering pattern for stolen cards and it unbalances the drawer.
- **Opened electronics, nothing wrong with them.** Standard answer: accept within 14 days with a 15% restocking fee and all accessories present. Defective within the window is an even exchange, no fee.
- **Book bought at 30% off, now full price.** Standard answer: refund the `price` paid. Today's shelf price is irrelevant.
- **Gift receipt, no purchaser present.** Standard answer: store credit or exchange at price paid. Never cash, never a refund to a card the person at the counter does not hold.
- **Customer is loud and insisting.** Standard answer: restate the policy once, calmly, then offer the manager. Do not negotiate policy at the register.

## 6. Standard guardrails

- Refund over $100 (some stores $250): manager override before the refund is keyed, not after.
- No receipt: store credit only, capped at $50 per transaction and 3 no-receipt returns per customer per 90 days, ID scanned every time.
- Cash refund over $50: manager counts it with you; over $200 many stores mail a check instead.
- `payment_method` is card: `refund_method` must be Original card. Never a different card, never cash.
- `item_type` is textbook_access_code and `condition` is Opened: deny. No exceptions at the counter.
- Portal result Warning or Denied: final at the counter. Only a manager overrides, and it is logged.
- Returning your own purchase or a friend's or coworker's: hand it to another cashier or the manager.
- Serial does not match the box or the sale, or the item carries another store's security tag: stop, keep the item on your side of the counter, call the manager.
- Final sale, clearance, magazines and opened software: non-returnable unless defective.

## 7. Mistakes new hires commonly make

- Refunding the shelf price instead of the `price` paid after coupons. The drawer is short and the customer got paid for a discount they never spent.
- Keying a blind refund when the sale was findable. Inventory does not adjust and the manager cannot audit it.
- Giving cash for a card purchase because the customer was polite. This is the exact case fraud policy exists for.
- Accepting a textbook with a scratched code panel because the book looked untouched. $90 of value walked out the door.
- Skipping the serial check on electronics. The box comes back with a brick or an older model inside.
- Refunding a whole bundle price when only one piece came back. The bundle discount has to be reversed.
- Leaving `status` at Open or Waiting for manager and moving on. End-of-day reconciliation breaks and the customer calls tomorrow.

## 8. Vocabulary

- **Original tender**: the payment method used on the original sale.
- **Linked return**: a refund keyed against the original transaction.
- **Blind return**: a refund with no original transaction attached.
- **Store credit**: a gift-card or account balance spendable only in the store.
- **Return window**: days after `purchase_date` a return is accepted, by category.
- **Add/drop deadline**: the campus date after which textbooks are no longer refundable.
- **Access code**: a one-time online code bundled with a textbook; spent once scratched.
- **Shrink-wrap rule**: a sealed textbook is returnable, an opened one is buyback only.
- **Buyback**: the store buying a used textbook back at a fraction of the price.
- **Restocking fee**: a percentage withheld on opened electronics returns.
- **Even exchange**: same item swapped, no money moves.
- **Price adjustment**: refunding the difference when the price drops within a set number of days.
- **Gift receipt**: receipt without prices; returns go to store credit.
- **Final sale**: marked non-returnable at purchase.
- **RTV**: return to vendor, defective goods sent back for credit.
- **Damage-out**: writing an item off as unsellable.
- **Override**: a manager authorizing an action beyond cashier limits.
- **Wardrobing**: buying, using once, and returning as new.
- **Shrink**: inventory lost to theft, fraud, damage and error.
- **Over/short**: the gap between counted and expected cash at close.
