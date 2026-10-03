# Zendesk Support

Zendesk Support is the ticketing system a customer-support-agent works in all day: every email, chat, call, or social message becomes a Ticket, and the agent's job is to move each ticket through its statuses while meeting the SLA.

## 1. What it is and who uses it

Zendesk Support is a web app (Agent Workspace) plus a mobile app. Agents answer tickets from Views; team leads build Macros, Triggers, Automations, and SLA policies in Admin Center; customers interact through email, the Help Center, Web Widget, or messaging. Zendesk is the default help desk for SaaS, e-commerce, and subscription businesses with anywhere from 3 to several hundred agents. For a customer-support-agent, the key screens are the Views list, the ticket itself (conversation plus the left-hand properties panel), the Customer context panel, and the Macro and status menus.

## 2. Main screens and objects

- **Views**: saved filters on the left sidebar. Defaults are `Your unsolved tickets`, `Unassigned tickets`, `All unsolved tickets`, `Recently updated tickets`, `Pending tickets`, `Recently solved tickets`, `Suspended tickets`, `Deleted tickets`. Teams add views like `Urgent - breaching SLA` and `Tier 2 queue`.
- **Ticket**: the conversation on the right (comments and events), the properties panel on the left (`Requester`, `Assignee`, `Tags`, `Type`, `Priority`, custom fields), and the composer at the bottom with a `Public reply` / `Internal note` switch.
- **Customer context panel** (right side): user's name, email, organization, `Interaction history`, open and recent tickets.
- **Dashboard** (agent home): counts for `Open`, `Pending`, `On-hold`, `Solved`, `New` and recent activity.
- **Admin Center**: `People` (agents, groups, roles), `Objects and rules` (ticket fields, tags, triggers, automations, SLA policies), `Workspaces` (macros, views, ticket forms).
- **Objects**: Ticket, Comment (public or private), Requester (end user), Agent, Group, Organization, Macro, Trigger, Automation, SLA policy, Tag, Ticket field, Ticket form, Satisfaction rating (CSAT).

## 3. Field names and statuses you would see

- Ticket header: `Ticket #12345`, subject line, `via` channel (`Email`, `Web form`, `Chat`, `Messaging`, `Phone`, `Voicemail`, `Facebook`, `X`, `API`), `Created`, `Updated`.
- Status pill and submit button: `New`, `Open`, `Pending`, `On-hold`, `Solved`, `Closed`. Button reads `Submit as New`, `Submit as Open`, `Submit as Pending`, `Submit as On-hold`, `Submit as Solved`. `Closed` is never chosen by hand; it is set by automation 4 days (configurable, up to 28) after `Solved`. Custom statuses may show, such as `Waiting on engineering` (category On-hold).
- Properties panel: `Requester`, `Assignee` (shown as `Group / Agent`, e.g. `Support / Maria Lopez`), `CCs`, `Followers`, `Tags`, `Type` (`Question`, `Incident`, `Problem`, `Task`), `Priority` (`Low`, `Normal`, `High`, `Urgent`), `Linked problem` (for Incidents), `Due date` (Task type only), `Form` picker, `Brand`.
- Common custom fields: `Category` dropdown, `Refund amount`, `Order number`, `Account tier` or `Plan` (`Free`, `Pro`, `Enterprise`), `Product area`, `Root cause`.
- Composer: toggle `Public reply` (black-on-white) vs `Internal note` (yellow background), `Apply macro` button, attachment clip, `CC` field, channel selector for messaging.
- SLA badge on the ticket and in Views: `First reply time`, `Next reply time`, `Periodic update time`, `Pausable update time`, `Requester wait time`, `Agent work time`, `Total resolution time`; countdown like `2h 15m` turning red when `Breached`; column `Next SLA breach`.
- Views columns: `Status`, `ID`, `Subject`, `Requester`, `Requested`, `Type`, `Priority`, `Group`, `Assignee`, `Satisfaction` (`Good`, `Bad`, `Offered`, `Unoffered`), `Tags`, `Next SLA breach`.
- Events panel (`Show all events` / `Conversations`): entries like `Status changed from Open to Pending`, `Trigger: Notify assignee of comment update`, `Tags added: refund_request`, `Assigned to Billing`, `Macro applied: Refund::Approve`.
- Satisfaction rating: `Good, I'm satisfied` / `Bad, I'm unsatisfied` with comment.
- Suspended tickets: `Cause of suspension` (`Detected as spam`, `Automated response email`, `Permission denied`, `User must be verified`).
- Problem/Incident link: `Problem` ticket with count `12 incidents`; solving the Problem offers `Solve all linked incidents`.
- Merge dialog: `Merge ticket #12345 into #12300`, with `Requester can see this comment` checkboxes.

## 4. Common actions

- **Public reply**: sends an email or message to the `Requester` and CCs. Submitting as `Pending` after a public reply is the normal "waiting on customer" move.
- **Internal note**: visible only to agents and light agents. Does not notify the requester. Used for escalation context, refund approvals, and handoffs.
- **Submit as Open**: ticket needs agent work; it counts against `Next reply time` SLA. A customer reply to a `Pending` or `On-hold` ticket automatically reopens it to `Open`.
- **Submit as Pending**: waiting on the requester. Pauses `Requester wait time` metrics; an automation often closes or bumps pending tickets after N days.
- **Submit as On-hold**: waiting on a third party or internal team (engineering, carrier). Looks like Pending to the customer but is tracked separately; must be enabled by admin.
- **Submit as Solved**: resolution sent. Starts the countdown to `Closed` and sends the CSAT survey if configured. The requester can reopen by replying until it closes.
- **Reopen**: change status from `Solved` back to `Open`. A `Closed` ticket cannot be reopened; replying creates a follow-up ticket with `This is a follow-up to your previous request #12345`.
- **Apply macro**: inserts canned text and can set `Status`, `Priority`, `Tags`, `Assignee`, `Type`, and custom fields in one click. Macros named with `::` show as nested menus (`Refund::Approve`, `Refund::Deny`).
- **Assign / Escalate**: change `Assignee` to a group (`Tier 2`, `Billing`) or an agent. Triggers typically notify the group. Escalations usually add a tag like `escalated` and an internal note.
- **Add tag**: free-text tags on the properties panel; triggers and views key off them.
- **Merge**: combine duplicate tickets; the source becomes `Closed` with a merge comment.
- **Mark as spam**: suspends the user and deletes the ticket.
- **Triggers**: fire on ticket create or update when conditions match (`Ticket: Priority is Urgent` and `Ticket: Status changed to Open`) and perform actions (`Notify group`, `Set priority`, `Add tags`). Agents do not run them; they see the results in events.
- **SLA policies**: assigned by conditions (e.g. `Organization tag is enterprise`) with targets per priority (Urgent first reply 1 hour, Normal 8 hours). The badge counts down on the ticket.

## 5. Where mistakes happen

1. **Internal note sent as public reply**: the composer defaults to the last-used mode. An agent types "this customer is being difficult, deny" with the toggle on `Public reply` and the customer gets it. Check the yellow background before Submit.
2. **Pending vs On-hold confusion**: setting `On-hold` while waiting on the customer stops the pending automation from nudging them, and the ticket sits for weeks. `Pending` = waiting on requester; `On-hold` = waiting on someone else.
3. **Solving without a reply**: `Submit as Solved` with only an internal note means the customer never hears back but gets a CSAT survey. They reopen angry or rate `Bad`.
4. **Replying to a Closed ticket**: a reply on a `Closed` ticket spawns a follow-up ticket with no assignee and no SLA; it lands in `Unassigned tickets` and gets missed.
5. **Priority left at `-`**: with no `Priority`, SLA policies keyed on priority do not apply, so the ticket shows no countdown and gets no escalation trigger. Set `Normal` at minimum.
6. **Macro that changes more than text**: applying `Refund::Approve` to insert its wording also sets `Status: Solved` and tag `refund_approved`; a trigger then notifies finance. Read the macro's actions before using it as a template.
7. **Changing `Requester` to the agent's own address**: happens when forwarding; the customer stops receiving replies and the CSAT goes to the agent.
8. **Assigning to a person instead of a group**: an escalation assigned directly to one Tier 2 agent who is out sick breaches SLA; assign to the `Tier 2` group so the whole team's view picks it up.
9. **Tag typos**: `refund-request` vs `refund_request` splits reporting and skips the trigger.
