CREATE TABLE document (
  document_id UUID NOT NULL,
  document_id UUID NOT NULL,
  source_system VARCHAR(50),
  received_timestamp DATETIME,
  raw_text VARCHAR(500),
  document_status VARCHAR(20),
  redacted_text VARCHAR(1000) NOT NULL,
  PRIMARY KEY (document_id)
);

CREATE TABLE finding (
  "(ambiguous)" INTEGER NOT NULL,
  start_position INTEGER NOT NULL,
  end_position INTEGER NOT NULL,
  piicategory VARCHAR(50),
  confidence_score DECIMAL(3,2),
  PRIMARY KEY ("(ambiguous)")
);

CREATE TABLE reviewer (
  employee_id VARCHAR(20) NOT NULL,
  employee_id VARCHAR(20),
  reviewer_name VARCHAR(100),
  clearance_level VARCHAR(20),
  PRIMARY KEY (employee_id)
);

CREATE TABLE review_decision (
  "(ambiguous)" TEXT NOT NULL,
  PRIMARY KEY ("(ambiguous)")
);

CREATE TABLE audit_entry (
  audit_id VARCHAR(50) NOT NULL,
  action_type VARCHAR(50),
  PRIMARY KEY (audit_id)
);

CREATE TABLE scan (
  scan_version VARCHAR(50) NOT NULL,
  model_version VARCHAR(50) NOT NULL,
  PRIMARY KEY (scan_version)
);

CREATE TABLE release (
  "(ambiguous)" DATETIME NOT NULL,
  release_timestamp DATETIME NOT NULL,
  redacted_content_hash VARCHAR(128),
  document_id UUID NOT NULL,
  PRIMARY KEY (document_id),
  FOREIGN KEY (document_id) REFERENCES document (document_id)
);

CREATE TABLE document_has_scan (
  document_id UUID NOT NULL,
  scan_version VARCHAR(50) NOT NULL,
  PRIMARY KEY (document_id, scan_version),
  FOREIGN KEY (document_id) REFERENCES document (document_id),
  FOREIGN KEY (scan_version) REFERENCES scan (scan_version)
);

CREATE TABLE scan_produced_finding (
  scan_version VARCHAR(50) NOT NULL,
  "(ambiguous)" INTEGER NOT NULL,
  PRIMARY KEY (scan_version, "(ambiguous)"),
  FOREIGN KEY (scan_version) REFERENCES scan (scan_version),
  FOREIGN KEY ("(ambiguous)") REFERENCES finding ("(ambiguous)")
);

CREATE TABLE finding_reviewed_by_reviewer (
  "(ambiguous)" INTEGER NOT NULL,
  employee_id VARCHAR(20) NOT NULL,
  PRIMARY KEY ("(ambiguous)", employee_id),
  FOREIGN KEY ("(ambiguous)") REFERENCES finding ("(ambiguous)"),
  FOREIGN KEY (employee_id) REFERENCES reviewer (employee_id)
);

CREATE TABLE review_decision_is_decision_of_finding (
  "(ambiguous)" TEXT NOT NULL,
  "has_decision_about_(ambiguous)" INTEGER NOT NULL,
  PRIMARY KEY ("(ambiguous)", "has_decision_about_(ambiguous)"),
  FOREIGN KEY ("(ambiguous)") REFERENCES review_decision ("(ambiguous)"),
  FOREIGN KEY ("has_decision_about_(ambiguous)") REFERENCES finding ("(ambiguous)")
);

CREATE TABLE audit_entry_about_document (
  audit_id VARCHAR(50) NOT NULL,
  document_id UUID NOT NULL,
  PRIMARY KEY (audit_id, document_id),
  FOREIGN KEY (audit_id) REFERENCES audit_entry (audit_id),
  FOREIGN KEY (document_id) REFERENCES document (document_id)
);

CREATE TABLE audit_entry_performed_by_reviewer (
  audit_id VARCHAR(50) NOT NULL,
  employee_id VARCHAR(20) NOT NULL,
  PRIMARY KEY (audit_id, employee_id),
  FOREIGN KEY (audit_id) REFERENCES audit_entry (audit_id),
  FOREIGN KEY (employee_id) REFERENCES reviewer (employee_id)
);