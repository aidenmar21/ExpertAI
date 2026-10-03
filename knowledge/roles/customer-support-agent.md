# Customer support agent, tier 1 tickets

Frontline agent who works the helpdesk queue for a subscription software product: answers, fixes, refunds within limits, and escalates what tier 1 cannot solve.

## 1. Purpose and who the role serves
Tier 1 is the first human the customer reaches. The agent serves the customer (a correct answer inside the SLA, no repeating themselves), the company (refunds only when policy says so, clean data on what is breaking), and tier 2 and engineering (escalations that arrive with reproduction steps, not "it doesn't work"). The measure is first-contact resolution, not tickets per hour. A fast wrong answer creates a second ticket and a worse CSAT.

## 2. Daily tasks
- Work the queue in `sla_due` order, not newest-first and not easiest-first.
- Send a first response on every New ticket inside its SLA; `first_response_sent` flips to Yes.
- Verify the customer before touching the account: email on file plus last four of the card, an invoice number, or the account ID.
- Triage: set `category`, `priority`, and `channel` so routing and reporting work.
- Reproduce reported bugs in a test account before escalating.
- Issue refunds and goodwill credits inside your limit; log `refund_amount`.
- Escalate to tier 2 with steps, account ID, timestamps, screenshots.
- Merge duplicates from the same `customer` into one thread.
- Bump Pending tickets at 2 and 4 business days before auto-solve fires.
- Cover chat at 2 to 3 concurrent conversations; phone one at a time.
- Tag spikes (five tickets on one error inside an hour) and tell the lead.
- Submit help-center edits when the same question hits three times in a week.

## 3. Software and screens typically used
- **Zendesk**: Views (Unassigned, My open, SLA breaching), the ticket screen with requester sidebar, Macros, the Internal note / Public reply toggle, the status submit button (Open, Pending, On-hold, Solved).
- **Salesforce** Service Cloud for Enterprise accounts: the Account record with contract, `account_tier`, named admin contacts; the Case list; Knowledge.
- **Gmail and Outlook**: the shared support@ mailbox for mail that bypassed the helpdesk, vendor status-page alerts.
- **Billing admin** (Stripe or the internal admin): subscription, invoices, the Refund button.

## 4. The standard workflow, step by step, done the right way
1. Sort the View by `sla_due`. Open the ticket closest to breach, read `priority`, `account_tier`, `channel`. Click Take it so `assignee` is you.
2. Read the whole thread and the requester sidebar: past tickets, plan, last invoice. If a duplicate exists, click Merge into the older ticket.
3. If the request touches billing, email, password, or data, verify identity first. Note "Verified via invoice #" internally.
4. Set `category` and `priority`: Urgent means cannot use the product or data at risk; High means a core feature broken with no workaround; Normal has a workaround; Low is how-to and feature requests. A Negative `sentiment` on a Pro or Enterprise ticket moves it one priority up.
5. Search Knowledge and the incidents channel. If an active incident matches, link to the problem ticket and send the incident macro.
6. Resolve: apply the macro, edit it to name the customer's actual symptom, take the action (fix the setting, click `refund`, or click `escalate` with repro steps).
7. Click Public reply: what happened, what you did, what happens next, by when.
8. Submit with the right status: Pending if waiting on the customer, On-hold if waiting on tier 2, Solved only when the fix is confirmed. Never set Closed by hand; automation closes 4 days after Solved.
9. Leave an internal note: what you checked, changed, and promised.
10. A reply to a Solved ticket reopens it; on a Closed ticket click `reopen` to spawn a linked follow-up.

## 5. Common judgment calls
- **Refund requested 10 days after an annual renewal they forgot.** Standard answer: full refund if inside the 14-day renewal grace window and no logins since renewal; otherwise prorated credit or downgrade. Renewal regret is the biggest chargeback source; paying it out is cheaper than disputing it.
- **Customer says a feature is broken, you cannot reproduce it.** Standard answer: ask for browser, OS, a screen recording, and the exact time; try impersonation mode if policy allows. Escalate only with a reproduction or three documented failed attempts, or tier 2 bounces it.
- **Free-tier user demanding phone support.** Standard answer: phone is a Pro and Enterprise benefit; answer fully on `channel` email and mention the upgrade page once.
- **Customer threatens a chargeback or lawyer.** Standard answer: stay factual, do not admit fault, do not refund to make it go away, `escalate` to the lead with the Legal tag. A refund after a chargeback is filed pays out twice.
- **Social complaint from an account with 5,000 followers.** Standard answer: public reply within 1 hour ("sorry, DM us your account email"), then everything in a private ticket.
- **Enterprise admin asks you to reset another user's password.** Standard answer: only if they are a named admin contact on the Salesforce Account; otherwise contact the user directly.
- **Customer wants a refund and a free month for the same outage.** Standard answer: one or the other. Outage credit follows the SLA table (typically 10% of the monthly fee per 1% below 99.9% uptime), never stacked with a refund.
- **Customer is abusive.** Standard answer: one written warning; if it continues, end the conversation, note the requester profile, tell the lead.

## 6. Standard guardrails
- **First-response SLA by `priority`**: Urgent 1 hour, High 4 hours, Normal 8 business hours, Low 2 business days. Enterprise contracts often tighten Urgent to 30 minutes, 24/7. The clock starts at creation, not assignment.
- **Resolution target by `priority`**: Urgent 4 hours, High 1 business day, Normal 3 business days, Low 5 business days. Past target, add the Breach tag.
- **Refund authority**: tier 1 alone up to $100 or one month's subscription, whichever is lower; $100 to $500 needs a team lead; over $500, any annual-plan refund, or a second refund to the same `customer` in 90 days needs a manager and finance.
- **Goodwill credit**: up to $25 without approval, once per customer per quarter.
- **Identity**: no account change, data disclosure, or payment action without verification. A customer pushing you to skip it is itself a reason to stop.
- **Card numbers and passwords**: never ask; if sent, redact in the ticket and tell them to change the password.
- **Data requests (deletion, export, GDPR, CCPA)**: tag Privacy and `escalate`; acknowledge in 1 business day, do not execute.
- **Promises**: never give a date for an engineering fix or feature.
- **Stop and ask the lead** when the request is unusual for the account, the refund is above limit, the customer names press, a regulator, or a lawyer, or five tickets show one error in an hour.

## 7. Mistakes new hires commonly make
- Sending the macro unedited. The customer replies again; one touch becomes two.
- Marking Solved while waiting on the customer. It auto-closes in 4 days, the reply opens a follow-up, and the SLA clock restarts against you.
- Working newest-first. The oldest Normal ticket breaches while three easy ones get answered; breaches are what the lead's report shows.
- Escalating without repro steps. Tier 2 bounces it the next day and the customer has waited two days for nothing.
- Changing the account email to the address the request came from, unverified. This is the account-takeover pattern and the mistake that gets written up.
- Issuing a refund and a replacement month. Finance catches the double payout at month end.
- Leaving `priority` at Normal on "cannot log in" from an Enterprise admin. It sits on an 8-hour SLA when the contract says 30 minutes.
- Not reading past tickets. The customer explains for the third time and says so in the CSAT comment.

## 8. Vocabulary
- **Ticket**: one customer request and its full conversation.
- **Requester**: the customer who raised the ticket.
- **Assignee**: the agent currently responsible.
- **View**: a saved, filtered queue of tickets.
- **SLA**: committed first-response and resolution times by priority.
- **First response time (FRT)**: minutes from creation to the first public reply.
- **First-contact resolution (FCR)**: solved in one reply, no escalation, no reopen.
- **Pending**: waiting on the customer; the auto-solve timer runs.
- **On-hold**: waiting on an internal team; the timer pauses.
- **Solved vs Closed**: Solved can reopen; Closed is final and spawns a follow-up.
- **Macro**: a saved reply with bundled actions (status, tags, assignee).
- **Internal note**: a comment only agents see.
- **Public reply**: a comment the customer receives.
- **Tag**: a label for routing, reporting, and triggers.
- **Trigger / automation**: rules that change tickets on events or time.
- **Problem ticket**: the parent linking every ticket about one outage.
- **Merge**: folding a duplicate into the original ticket.
- **Escalation**: handing the ticket to tier 2, engineering, or a lead.
- **Goodwill credit**: a small account credit given to repair the relationship.
- **Chargeback**: the customer's bank reversing a payment after a dispute.
