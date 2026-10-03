# Shopify POS

Shopify POS is the in-store register app for stores that also sell online on Shopify; every in-person sale becomes an Order in the same Shopify admin, and returns, exchanges, refunds, and store credit all run against that Order.

## 1. What it is and who uses it

Shopify POS runs on an iPad or Android tablet with a card reader, and syncs to the Shopify admin (web). The cashier uses the POS app for sales and returns; the store manager uses the admin's Orders page for anything the app cannot do, such as editing an order or refunding without the original receipt. Because online and in-store orders share one Orders list, a cashier can return an item bought on the website. For a retail-cashier-returns role, the screens that matter are Orders (find the sale), Returns and exchanges (the flow), Refund (how the money goes back), and the Restock toggle.

## 2. Main screens and objects

- **Smart grid / Checkout**: the sale screen with product tiles, a Cart, and the `Checkout` button.
- **Orders**: in the POS app under the Orders tab; in admin under Orders. Lists every order across channels (`Point of Sale`, `Online Store`, `Draft Orders`). Open an order for line items, payment, fulfillment, and timeline.
- **Returns & exchanges**: started from an order. Pick items to return, optionally add items for an exchange, choose refund method.
- **Draft orders**: an unpaid order a staff member builds (quotes, phone orders, custom items). Converted to a real order on payment; shows up in Orders with the `Draft` origin.
- **Customers**: profile with order history, `Store credit` balance, tags, notes.
- **Products**: variants, SKU, barcode, `Inventory` quantity per location.
- **Gift cards**: under Products > Gift cards in admin; sold and redeemed in POS.
- **Objects**: Order, Line item, Fulfillment, Return, Refund, Transaction, Draft order, Customer, Gift card, Store credit account.

## 3. Field names and statuses you would see

- Order header: `Order #1042`, `Date`, `Customer`, `Channel` (`Point of Sale`, `Online Store`), `Location`, `Staff`.
- Payment status badge: `Paid`, `Partially paid`, `Pending`, `Authorized`, `Refunded`, `Partially refunded`, `Voided`, `Unpaid`, `Expired`.
- Fulfillment status badge: `Fulfilled`, `Unfulfilled`, `Partially fulfilled`, `On hold`, `Scheduled`, `In progress`.
- Return status (admin Orders filter and order badge): `Return requested`, `Return in progress`, `Returned`, `Inspection complete`.
- Order totals: `Subtotal`, `Discount`, `Shipping`, `Taxes`, `Total`, `Paid by customer`, `Net payment`, `Refunded`.
- Line item: product title, variant (`Size / Color`), `SKU`, `Qty`, unit price, `Discount` chip.
- Return & exchange flow: `Return items` with quantity steppers, `Return reason` (`Unknown`, `Size was too small`, `Size was too large`, `Customer changed their mind`, `Item not as described`, `Wrong item was sent`, `Defective`, `Style`, `Color`, `Other`), `Add exchange items`, `Restock at` location picker, `Restock` toggle per line, `Refund amount`, `Amount available to refund`.
- Refund method options: `Refund to original payment method`, `Store credit`, `Gift card`, `Cash`, `Manual` (admin only, for recording an offline refund).
- Refund confirmation: `Send a notification to the customer` checkbox, `Reason for refund` free text.
- Customer profile: `Store credit` with `Balance`, `Credit` and `Debit` buttons, `Expiry` if set; `Tags`; `Orders` count; `Amount spent`.
- Draft orders: `Draft #D21`, status `Open`, `Invoice sent`, `Completed`; buttons `Mark as paid`, `Send invoice`, `Collect payment`.
- Gift card: `Gift card code` (last 4 shown), `Balance`, `Expires`, status `Enabled`/`Disabled`.
- Staff permission prompt: `Manager approval required` with a PIN field when refunds are restricted by role.

## 4. Common actions

- **Find the order**: Orders tab > search by order number, customer name, email, phone, or scan the receipt QR code. In POS, `Lookup order` also accepts card last 4 for card-paid orders.
- **Return**: open order > `Return` (POS: `Exchange or return`). Tick items, set quantities, pick a `Return reason`. The reason is saved on the Return object and shows in reports.
- **Exchange**: in the same flow, `Add exchange items`. Shopify nets the returned value against the new items and shows `Amount to collect` or `Amount to refund`. One order is updated and a linked exchange order is created.
- **Refund to original payment method**: card goes back to the same card (3-10 business days). Available for 180 days on Shopify Payments; after that the option disappears and only `Store credit`, `Gift card`, or `Cash` remain.
- **Store credit**: issues credit to the customer's `Store credit` account. Requires a customer attached to the order; otherwise the button is disabled. Sets order payment status to `Refunded` and posts a `Credit` on the customer.
- **Gift card refund**: issues a new gift card for the refund amount and emails or prints the code. Preferred when the customer has no profile.
- **Restock toggle**: per line, with a `Restock at` location. On returns inventory at that location by the returned quantity. Off means the item is written off (damaged, defective).
- **Partial refund**: enter a `Refund amount` lower than `Amount available to refund`; order becomes `Partially refunded`.
- **Mark as returned without refund**: possible in admin (`Return` then `Refund later`); the order shows `Returned` but payment status stays `Paid`.
- **Draft order**: `Create draft order` > add items, customer, discount > `Collect payment` or `Send invoice`. Used for special orders and deposits.

## 5. Where mistakes happen

1. **Refund without the return**: using the admin `Refund` button directly skips the Return object, so no return reason is logged and `Restock` is easy to miss. Always go through `Exchange or return` first.
2. **Restock left on for defective goods**: a cracked item goes back into available inventory and gets sold again. Toggle `Restock` off and note the reason as `Defective`.
3. **Restocking at the wrong location**: `Restock at` defaults to the order's fulfillment location, which for an online order is the warehouse. In-store returns should restock at the store location.
4. **Store credit to a walk-in with no profile**: the `Store credit` option is grayed out and the cashier gives cash instead. Fix is to create or attach the customer, or use `Gift card`.
5. **Refunding an online order's shipping**: `Amount available to refund` includes shipping; refunding the full amount in store hands back shipping the customer is not owed under most policies. Refund the item lines only.
6. **Missing the 180-day window**: `Refund to original payment method` silently disappears for old orders. New hires say "the system won't let me" instead of switching to `Gift card`.
7. **Exchange rung as a new sale**: ringing the replacement at Checkout without linking it loses the net calculation, double counts revenue, and leaves the original order `Paid` with no return.
8. **Draft order never completed**: a deposit taken on a draft that is left `Open` means the item is never reserved and the deposit does not appear on the final order.
