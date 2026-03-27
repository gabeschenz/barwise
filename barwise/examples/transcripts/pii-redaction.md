Facilitator: So I want to understand how your team handles PII redaction. Can you start with what kinds of documents come in?

Compliance Lead: Yeah, so we receive documents from a bunch of different sources -- customer support tickets, loan applications, medical intake forms, free-text survey responses. They all land in what we call the document queue.

Facilitator: How do you identify a document?

Compliance Lead: Every document gets a document ID when it enters the queue. It's system-generated, a UUID. We also capture the source system it came from, the timestamp it was received, and the original content as raw text.

Facilitator: Is the source system just a free-text field, or...?

Compliance Lead: No, it's controlled. We have a fixed set right now: customer-support, lending, health-intake, and survey. If a new source comes online we add it to the list, but it's not freeform.

Facilitator: Got it. So what happens once a document is in the queue?

Compliance Lead: It goes through a scan. The scanner looks for PII in the text and produces findings. A finding is basically "we found this type of PII at this location in the document."

Data Engineer: To be more specific -- each finding records the start position and end position in the text, the PII category, and a confidence score. The confidence score is a decimal between zero and one.

Facilitator: What are the PII categories?

Data Engineer: Let me think... we have: full-name, email-address, phone-number, date-of-birth, social-security-number, credit-card-number, mailing-address, ip-address, and passport-number. I think that's all of them. Actually wait -- we also added drivers-license-number last quarter.

Compliance Lead: Yeah, ten categories total.

Facilitator: And how is a finding identified? By some kind of finding ID?

Data Engineer: No, a finding doesn't have its own ID. It's identified by the combination of the document and the start position. You can't have two findings starting at the same character position in the same document -- the scanner merges overlapping detections.

Facilitator: That makes sense. What about the confidence score -- are there thresholds?

Compliance Lead: Yes. Anything below 0.5 we discard automatically -- it's noise. Between 0.5 and 0.85 goes into a review queue for a human to confirm. 0.85 and above is auto-confirmed.

Facilitator: So there's a human review step?

Compliance Lead: For some findings, yes. We have reviewers -- they're employees in the compliance department. Each reviewer is identified by an employee ID. We track their name and their clearance level. Clearance level is one of: standard, elevated, or restricted. Restricted clearance means they can see SSNs and financial data. Standard reviewers can't -- they only handle names, emails, phone numbers, that sort of thing.

Facilitator: So the clearance level determines which PII categories a reviewer can see?

Compliance Lead: Exactly. Each clearance level authorizes a reviewer for a specific set of PII categories. Standard covers full-name, email-address, phone-number, and mailing-address. Elevated adds date-of-birth, ip-address, drivers-license-number, and passport-number. Restricted covers everything, including social-security-number and credit-card-number.

Data Engineer: It's cumulative, right? Elevated includes everything in standard plus more.

Compliance Lead: Right, each level is a superset of the one below it.

Facilitator: What does a review look like? The reviewer looks at a finding and then what?

Compliance Lead: They make a review decision. They can confirm the finding, reject it -- meaning it's a false positive -- or reclassify it to a different PII category. Every review decision has a timestamp and an optional note explaining the rationale.

Facilitator: Can multiple reviewers weigh in on the same finding?

Compliance Lead: No. One finding, one reviewer, one decision. Once it's decided, it's decided. If there's a dispute it gets escalated, but that's outside this system.

Facilitator: OK. So after scanning and review, what actually happens to the PII?

Data Engineer: We produce a redacted version of the document. The redacted document keeps the same document ID -- it's not a separate entity. It's more like a state the document moves into. The document has a status that goes from queued to scanned to reviewed to redacted. Not every document hits every status -- if all findings are high-confidence, it skips reviewed and goes straight to redacted.

Facilitator: Hang on -- so the document itself has a lifecycle?

Data Engineer: Yeah. Queued means it just arrived. Scanned means the PII scan finished. Reviewed means all its findings that needed human review have been decided. Redacted means the final redacted text has been generated.

Compliance Lead: There's also a failed status for documents where the scanner errors out. And we recently added on-hold for documents flagged by legal.

Facilitator: So that's six statuses: queued, scanned, reviewed, redacted, failed, on-hold?

Compliance Lead: That's right.

Facilitator: How does the actual redaction work?

Data Engineer: For each confirmed finding -- either auto-confirmed or human-confirmed -- we replace the text between the start and end positions with a redaction token. The token looks like [REDACTED:category], so you'd see [REDACTED:email-address] or [REDACTED:social-security-number] in the output. The redacted text is stored as a new field on the document.

Facilitator: Do you keep the original text too?

Compliance Lead: Yes, always. We're required to retain the original for audit purposes. But access to the original text is restricted to users with elevated or restricted clearance.

Facilitator: Let's talk about the audit side. What do you track?

Compliance Lead: Every action on a document is logged in an audit trail. An audit entry captures who did what, when, and to which document. The "who" is either the system -- for automated actions like scanning -- or a specific reviewer. The "what" is an action type: scan-initiated, scan-completed, review-assigned, review-completed, redaction-applied, document-released, or status-changed.

Facilitator: Is an audit entry identified by its own ID?

Compliance Lead: Yes, each audit entry has an audit ID. It also records the timestamp and an optional detail field for additional context -- like which finding was reviewed, or what the previous status was.

Facilitator: Can a document be re-scanned?

Data Engineer: Good question. Yes, if the PII detection model is updated, we can re-scan. When that happens, all existing findings for that document are archived and new findings are generated. The document goes back to scanned status. We track which scan version produced each finding -- the scan version is just an integer that increments.

Facilitator: So a finding is really identified by document, scan version, and start position?

Data Engineer: Oh, you're right -- I left out scan version earlier. Yes, the full identifier for a finding is the document, the scan version, and the start position.

Facilitator: Are there any rules about how quickly documents need to be processed?

Compliance Lead: We have SLAs. Every document must reach redacted status within 72 hours of receipt. If it's been more than 48 hours and it's still in reviewed or scanned, an alert fires. Documents with social-security-number or credit-card-number findings have a tighter SLA -- 24 hours.

Facilitator: One more thing -- you mentioned documents get released. What does that mean?

Compliance Lead: Once a document is fully redacted, it can be released to downstream systems. A release records which downstream system received it, the timestamp, and the redacted content hash -- we use it to verify integrity. A document can be released to multiple downstream systems. Each release is identified by the combination of the document and the downstream system.

Facilitator: And the downstream systems -- are they the same list as the source systems?

Compliance Lead: No, different list. Downstream systems are: analytics-warehouse, customer-portal, regulatory-filing, and partner-api. Totally separate from where the documents come from.

Facilitator: I think that covers the core process. Let me play back the key business rules I've captured, and you tell me if I'm missing anything.

Compliance Lead: Go ahead.

Facilitator: A document comes from exactly one source system and has exactly one status at any time. Each finding belongs to one document and one scan version, identified by document plus scan version plus start position. Findings have a PII category and confidence score. Findings below 0.5 confidence are discarded. Those between 0.5 and 0.85 require human review. 0.85 and above are auto-confirmed. A reviewer has a clearance level that determines which PII categories they can review. One reviewer per finding, one decision. Confirmed findings get redacted with category-tagged tokens. The original text is always retained. Everything is audit-logged. Documents must be redacted within 72 hours, or 24 for sensitive categories. Redacted documents can be released to one or more downstream systems.

Compliance Lead: That's solid. One thing to add -- a reviewer can only be assigned findings for documents that are in scanned status. Once the document moves to reviewed, no new assignments can happen.

Data Engineer: And each scan version is associated with a model version string -- like "pii-detect-v2.3.1". We track that so we know which model produced which findings.

Facilitator: Good catches. I think we have a complete picture now.
