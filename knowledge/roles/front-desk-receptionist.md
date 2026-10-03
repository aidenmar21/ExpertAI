# Front desk receptionist, hotel check-in

Front desk agent at a full-service hotel who checks guests in and out, verifies identity and payment, assigns rooms, and handles upgrades, fees, and complaints within set limits.

## 1. Purpose and who the role serves
The desk is where the reservation becomes a stay. The agent serves the guest (in the room fast, at the rate and room type they booked, treated like the tier they earned), the hotel (every room paid for, every incidental covered by a card hold, nobody in a room who is not on the folio), and the night audit (a folio that balances). One part hospitality, one part fraud prevention, in the same sentence.

## 2. Daily tasks
- Read the handover log and arrivals list: VIPs, Gold and Platinum `loyalty_tier`, groups, `special_requests`, declined-card flags.
- Pre-assign rooms: match `room_type`, connecting rooms, accessible rooms, high floor, away from the elevator.
- Check in guests: verify ID, take the card authorization, confirm `rate`, `check_in`, `check_out`, issue keys.
- Check out guests: review the folio line by line, settle `balance_due`, email the receipt.
- Post charges and adjustments: parking, minibar, late checkout, pet fee, reversals.
- Process no-shows after cutoff (midnight or 6 am): set `status` to No show, post the first night.
- Answer the phone; take messages for in-house guests without confirming they are in-house.
- Reconcile the cash drawer at shift end (float $200 to $300) and drop the envelope.
- Block rooms for maintenance on a reported fault; move the guest if it is not fixed in 30 minutes.
- Log every complaint and what was given, so the next shift does not give it twice.

## 3. Software and screens typically used
- **PMS** on the hotel's web form (Opera Cloud, Mews, Cloudbeds, protel): Arrivals, one row per `reservation_no`; Reservation detail with `guest`, `room_type`, `rate`, `check_in`, `check_out`, `loyalty_tier`, `special_requests`; the Room Rack (Clean, Dirty, Inspected, Out of order); the Folio with `balance_due`; the Payment window where `card_on_file` is set.
- **Google Calendar**: group arrivals, shuttle slots, the manager-on-duty rota.
- **Gmail and Outlook**: confirmations and receipts, OTA virtual card notices, the daily VIP sheet from sales.

## 4. The standard workflow, step by step, done the right way
1. Ask for the name on the reservation. Search by last name on Arrivals; confirm by `check_in` date and `room_type`, not name alone (two Smiths arrive most days).
2. Ask for government photo ID. Check the name matches `guest`, the photo matches the person, and it is not expired. Set `id_verified` to Yes. Minimum age 18 (21 at many US properties).
3. Ask for a physical card in the guest's name. Insert it and authorize room and tax for the stay plus incidentals of $50 to $100 per night ($100 to $150 at resorts). Set `card_on_file` to Yes. A prepaid OTA booking still needs the guest's own card for incidentals.
4. Confirm out loud: `room_type`, nightly `rate`, dates, and any `balance_due` on a pay-at-hotel rate. Mention parking and the resort fee now, not at checkout.
5. Open the Room Rack. Read `special_requests`, then assign an Inspected room matching the booked `room_type`. Never a Dirty or Out of order room.
6. Apply tier benefits unasked: Gold gets a one-category `upgrade` if available and 2 pm checkout; Platinum gets the next category and 4 pm. Note it on the reservation.
7. Encode two keys. Write the room number on the key packet; say the floor aloud, not the number.
8. Click `check_in`. Confirm `status` is Checked in and the folio opened. Hand over keys, directions, Wi-Fi, breakfast hours.
9. At checkout, read the Folio with the guest, settle `balance_due`, release the hold, email the receipt, click check out, confirm `status` is Checked out.
10. Note anything unusual in reservation comments and the handover log.

## 5. Common judgment calls
- **Guest arrives at 11 am; check-in is 3 pm.** Standard answer: if an Inspected room in their category exists, check them in; otherwise store bags and text when ready. Early check-in before noon is $25 to $50; waived for Gold and Platinum.
- **Name on the card does not match the ID.** Standard answer: refuse it. Ask for a card in the guest's own name, or a manager-approved third-party authorization form with the cardholder's ID and card copy. This is the most common desk fraud.
- **Guest refuses to leave a card and offers cash.** Standard answer: full stay in advance plus a $100 to $250 cash incidental deposit, refunded at checkout. Never check in with neither.
- **Anniversary guest asks for a suite.** Standard answer: a one-category upgrade is yours when available and occupancy is under about 85%. Suites or a sold-out night go to the manager. Offer wine or late checkout first.
- **Guest disputes a $45 minibar line at checkout.** Standard answer: reverse it. Under $50 you remove it on the spot; the argument costs more than $45.
- **Overbooked by two, three arrivals still due.** Standard answer: walk the lowest-tier, latest-booked, one-night guests, never loyalty members or groups. The hotel pays the first night at a comparable hotel plus transport. Call the manager before the first walk.
- **Caller asks whether a named guest is staying here.** Standard answer: never confirm or deny. Offer to connect to the room or take a message; law enforcement or a safety concern goes to the manager.

## 6. Standard guardrails
- **No ID, no check-in.** Unexpired government photo ID matching `guest`. A photo of an ID on a phone does not count; set `id_verified` only when you held the document.
- **No card, no keys.** `card_on_file` Yes or a cash deposit posted before clicking `check_in`. The hold covers room, tax, and $50 to $100 per night incidentals.
- **Fee waivers**: up to $50 per stay on your own (late checkout, one parking night, a minibar line); $50 to $150 needs the manager on duty; a full night, the resort fee, or over $150 needs the general manager.
- **Upgrades**: one category when available; suites, club floor, or any upgrade above 85% occupancy need the manager. Every upgrade logged with a reason.
- **Room numbers**: never spoken aloud, never given to a caller or visitor; re-keys only after ID.
- **Card data**: no full card numbers written, emailed, or kept beyond the PCI authorization form, shredded after the stay.
- **Call the manager** when a guest refuses ID or card, becomes aggressive, asks for a third room change, when police arrive, when a welfare check gets no answer, or before walking anyone.
- **Deny**, politely and with a colleague present, when the ID is fake or mismatched, the card declines twice with no alternative, or the guest is on the do-not-rent list.

## 7. Mistakes new hires commonly make
- Checking in on the OTA virtual card alone. It covers room and tax only; the minibar and parking go uncollected.
- Saying the room number aloud. The lobby now knows where a solo traveler sleeps; that is a safety incident.
- Assigning from Clean without checking Inspected. The guest finds a stripped bed.
- Not matching the card name to the ID. The stolen-card chargeback lands 90 days later with your name on the check-in.
- Posting the no-show before cutoff. The guest arrives at 11 pm, the room is gone, and now you owe a walk.
- Skipping `special_requests`. The accessible-room request was there; the guest in a wheelchair is at the desk at midnight.

## 8. Vocabulary
- **Folio**: the running bill for a stay, one per reservation.
- **Authorization (hold)**: an amount reserved on the card, released after checkout.
- **Incidentals**: non-room charges: minibar, parking, room service, spa.
- **Resort fee**: a mandatory daily amenity fee posted separately from the rate.
- **Rack rate**: the published full room price before discounts.
- **BAR**: best available rate, the public rate for the day.
- **OTA**: online travel agency such as Expedia or Booking.com.
- **Virtual card (VCC)**: a one-use card number an OTA issues for room and tax.
- **Walk**: sending a guest with a reservation to another hotel because you are full.
- **Overbooking**: selling more rooms than exist, expecting cancellations.
- **No-show**: a guaranteed reservation that never arrived; charged the first night.
- **Cutoff**: the time after which no-shows are processed and rooms released.
- **Room status**: Clean, Dirty, Inspected, Out of order; only Inspected is sellable.
- **Out of order (OOO)**: a room removed from inventory for maintenance.
- **Comp**: a charge or night given free, with a logged reason.
- **Pre-assign**: choosing rooms for arrivals ahead of time, for VIPs and requests.
- **Night audit**: the end-of-day run that posts room and tax and rolls the date.
- **Do-not-rent list**: guests banned for damage, non-payment, or conduct.
- **Loyalty tier**: program status (None, Silver, Gold, Platinum) that sets benefits.
- **Welfare check**: entering a room with security when a guest cannot be reached.
