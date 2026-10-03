# Salesforce (Service Cloud and custom objects)
Salesforce is the CRM most support teams and insurers run on: a database of Accounts, Contacts and Cases, plus whatever custom objects the company built on top, such as a `Claim__c` object with its own record types and approval process.

## 1. What it is and who uses it
Service Cloud is the support-desk flavour of Salesforce. Agents work out of the Service Console: a tabbed workspace where each Case opens as a sub-tab under its Account. Support agents own Cases; claims intake staff usually work a custom object (Claim, Claim__c under the hood) that an admin built with its own page layout, picklists and approval steps. Supervisors manage Queues, assignment rules and Omni-Channel routing; admins own the configuration. Every record has a 15- or 18-character Id and a URL you can paste to a colleague.

## 2. Main screens and objects
- **Home / App Launcher**: pick the app (Service Console, Claims).
- **List views**: the table of records for one object with a view picker at the top-left (My Open Cases, All Open Cases, Unassigned Queue, Recently Viewed). Columns are sortable; the filter panel is on the right.
- **Record page** (Case, Account, Contact, Claim): Highlights Panel across the top with the key fields and action buttons, then tabs: Details, Related, Feed (Chatter), and for Cases the Case Feed with email, log-a-call and post publishers.
- **Objects**: Account (the company or household), Contact (the person), Case (the ticket), Case Comment, Email Message, Task, Knowledge Article, Queue (a shared owner), Entitlement and Milestone (SLA clock), and custom objects such as Claim, Policy, Claim Line, Payment.
- **Omni-Channel utility**: the widget in the footer bar where an agent goes Available/Busy/Offline and accepts pushed work.
- **Approval history** related list on records that go through an approval process.

## 3. Field names and statuses you would see
- Case: Case Number (00001234), Subject, Description, Status, Priority, Case Origin, Case Owner, Contact Name, Account Name, Type, Case Reason, Date/Time Opened, Date/Time Closed, Escalated (checkbox), Entitlement Name, Milestone Status, Internal Comments, Web Email, Web Name.
- Case Status values (default): New, Working, Escalated, Closed. Common customised sets: New, In Progress, Waiting on Customer, Waiting on Internal, Escalated, Resolved, Closed.
- Case Priority values: High, Medium, Low (often extended with Critical / Urgent).
- Case Origin values: Phone, Email, Web, Chat, Social, Email-to-Case.
- Account: Account Name, Account Number, Type (Customer, Partner, Prospect), Industry, Billing Address, Phone, Account Owner, Parent Account, SLA (Gold, Silver, Platinum), Active.
- Contact: Name, Title, Email, Phone, Mobile, Account Name, Mailing Address, Contact Owner, Do Not Call, Email Opt Out.
- Claim__c (typical layout): Claim Number (CLM-000123), Policy Number, Policy Status (Active, Lapsed, Cancelled), Claimant, Date of Loss, Date Reported, Loss Type (Auto, Property, Injury, Theft), Loss Description, Estimated Loss Amount, Deductible, Reserve Amount, Police Report Filed (checkbox), Photos Received (checkbox), Prior Claims (12 mo), Fraud Indicators, Adjuster, Record Type (Auto Claim, Property Claim, Injury Claim), Status.
- Claim Status values (typical): New, Open, Pending Documents, Assigned, Under Review, Referred to SIU, Approved, Denied, Closed.
- Approval fields: Approval Status (Not Submitted, Pending, Approved, Rejected, Recalled), Approver, Submitted By, Comments.
- Omni-Channel presence statuses: Available, Busy, Offline (plus custom ones like Available - Chat).
- Owner shows either a user name or a queue name, with a small icon telling which.

## 4. Common actions
- **New Case / New Claim**: opens the create form; the record type picker appears first if more than one record type exists. Picking the wrong record type gives the wrong page layout and picklist values.
- **Change Owner**: reassigns to a user or queue. "Send notification email" checkbox. Taking a Case from a queue sets Case Owner to you; `Accept` in a queue list view does the same.
- **Edit** (or inline pencil on a field), then **Save**. Required fields show a red asterisk and block Save with "Complete this field".
- **Close Case** / set Status to Closed: often a separate quick action that forces a Resolution field. Many orgs have a validation rule that Closed requires a Case Reason.
- **Escalate**: ticks the Escalated checkbox; escalation rules do the same automatically when a Case sits past its threshold (for example 2 hours at High priority) and can reassign it to a Tier 2 queue.
- **Email** publisher in the Case Feed: picks a template, sends from the support address, logs an Email Message on the Case. **Log a Call** creates a completed Task.
- **Submit for Approval** on a Claim: locks the record, creates an Approval Request for the assigned approver; **Approve / Reject / Recall** on the approval item.
- **Attach a Knowledge article** from the Knowledge sidebar: links the article to the Case and can email it to the contact.
- **Omni-Channel Accept / Decline** on pushed work; declining sends it back to the queue.
- **Merge Cases / Merge Contacts** (if enabled) combines duplicates, keeping the master record's values.

## 5. Where mistakes happen
- Working a Case that is still owned by the queue. Nothing in the record says "yours"; another agent takes it and two replies go out. Change Owner to yourself before you reply.
- Editing the wrong Contact's Case because the Account has three people with the same first name; the Highlights Panel shows Account, not Contact, prominently.
- Status set to Closed with Case Reason blank or wrong (Other) just to clear the validation rule. Reporting on root causes becomes garbage.
- Choosing the wrong record type on New Claim; the page layout then hides the fields the adjuster needs, and the approval process routes to the wrong approver.
- Submit for Approval before the required attachments are on the record. The record locks, the approver rejects, and the clock on the Milestone keeps running.
- Replying by email from a personal inbox instead of the Case Feed email publisher, so nothing is logged on the Case and the SLA milestone is not marked as first response.
- Setting Omni-Channel to Available with a chat queue, then walking away; the chats time out against the agent's name.
- Entering the Date of Loss as the Date Reported (or the reverse), which silently breaks late-reporting checks and policy-period validation.
- Typing a note into Description (customer-visible on portals) instead of Internal Comments.
