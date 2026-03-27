=== Import: rb-global-account-taxonomy ===
Transcript: rb-global-account-taxonomy.md
Model used: claude-opus-4.6
Latency: 235218ms
Prompt length: 14786 chars

AMBIGUITIES:

- Identification of UserAccountMembership: The transcript states uniqueness is by (UserId, AccountId) but also mentions historical rows are allowed with EffectiveTo tracking. A surrogate MembershipId was assumed as the identifier. It is unclear whether the natural composite key (UserId, AccountId, EffectiveFrom) should be the true identifier or whether a surrogate MembershipId is used. The stakeholders should clarify whether MembershipId exists or if composite identification is intended.
  [lines 39-39] "Uniqueness is by (UserId, AccountId). A user can have at most one active membership row per account."
  [lines 43-43] "We track membership history through EffectiveFrom and EffectiveTo timestamps plus MembershipStatus."
- Identification of AccountOrganizationLink: The transcript describes uniqueness per (Account, Organization, OperatingRegion) for current active links, but allows historical rows. A surrogate LinkId was assumed. It is unclear whether a surrogate LinkId exists or if identification is by composite (AccountId, OrganizationId, OperatingRegion, EffectiveFrom).
  [lines 71-71] "We model it via AccountOrganizationLink. It carries operational scope and lifecycle data."
  [lines 123-123] "One account can have at most one current active link to a given organization per operating region."
- Cardinality: Is the Organization-to-OrgType relationship truly many-to-many (one OrgType value can apply to many Organizations AND one Organization can have many OrgType values), or is it one-to-many from Organization? The transcript says 'many-to-many' but since OrgType is a value type with fixed values, this is really multi-valued per Organization (each Organization can have multiple OrgType values). The uniqueness should be on the (Organization, OrgType) pair.
  [lines 87-87] "Organization to OrgType is many-to-many."
  [lines 83-83] "Multiple types can apply to one organization."
- Optionality: Is OperatingRegion mandatory on every AccountOrganizationLink, or only for cross-border organizations? The Domain Architect explicitly flagged this as an open question.
  [lines 276-276] "Whether OperatingRegion should be required on every AccountOrganizationLink or only for cross-border organizations."
- Optionality: Whether Organization should be mandatory at account creation for all onboarding channels. The transcript notes setup accounts can temporarily have zero organizations, but the rule for when linkage becomes mandatory is unclear across channels.
  [lines 131-131] "Yes for transacting accounts. But we also allow setup accounts in pre-onboarding state with zero organizations temporarily."
  [lines 275-275] "Whether Organization should be mandatory at account creation for all onboarding channels."
- Constraint completeness: Whether the account_owner role must be unique per account (exactly one owner) or can remain many (multiple co-owners). The transcript says 'at least one, potentially many' but this was explicitly flagged as an open question.
  [lines 254-254] "Every active account must have at least one active membership with role account_owner."
  [lines 258-258] "Yes, at least one, potentially many."
  [lines 278-278] "Whether account_owner role must be unique per account or can remain many."
- Temporal: The direct UserOrganizationScope (narrowing layer) is described as optional and may be deferred to a future version. It is unclear whether this should be modeled in v1. The Domain Architect flagged this as an open question.
  [lines 143-143] "We can model optional UserOrganizationScope as a narrowing layer."
  [lines 277-277] "Whether direct UserOrganizationScope should be part of v1 or deferred."
- Granularity: BuyerProfile and SellerProfile are mentioned as optional, role-specific profiles under Organization, but their attributes and lifecycle details are not specified. It is unclear what properties these profiles carry beyond the organizational identity (e.g., onboarding state, compliance controls, permissions).
  [lines 95-95] "we may model separate participation profiles for that organization: a BuyerProfile and a SellerProfile"
  [lines 99-99] "This preserves legal identity while allowing operational separation, separate onboarding states, independent policy checks, and distinct permissions."
  [lines 103-103] "Profiles are introduced when buyer and seller need separate lifecycle or compliance controls."
- Derivation: User access to Organizations is described as derived (through active Membership + active Link), not stored directly. Should the derived access path be formalized as a derived fact type, or is it purely application logic? The transcript describes it as a derivation rule but does not specify whether it should be materialized.
  [lines 139-139] "Access is derived. Users do not link directly to organizations in the base model."
  [lines 236-237] "A user can transact for an organization only if access is derived from active Membership plus active Link, and optional narrowing scope does not exclude it."
- Constraint completeness: The conditional rule 'If account status is active, at least one active AccountOrganizationLink must exist' is a conditional mandatory constraint that depends on AccountStatus being 'active'. Standard ORM constraints may not directly express this conditional logic without a subset constraint or external rule. Clarification is needed on how to enforce this.
  [lines 135-135] "If status is active, at least one active AccountOrganizationLink must exist."
  [lines 234-234] "Active Account requires at least one active AccountOrganizationLink."
- Constraint completeness: The rule that 'no active membership can exist if account status is closed' and 'no active link can exist if account status is closed' are cross-entity conditional constraints. These may require formalization as external rules or triggers rather than standard ORM constraints.
  [lines 246-246] "Historical rows can exist, but no active membership can exist if account status is closed."
  [lines 250-250] "Historical rows yes, active link no."
- Overloaded terms: The term 'role' is used in two different senses: (1) AccountRoleType for user permissions within an account (account_owner, account_admin, etc.), and (2) LinkTransactionRole for buyer/seller transaction scope on an AccountOrganizationLink. These are distinct concepts but could cause confusion.
  [lines 51-51] "Typical account roles are account_owner, account_admin, account_member, billing_admin, and read_only."
  [lines 115-115] "one or more LinkTransactionRole values on AccountOrganizationLink, with allowed values buyer and seller"
- Granularity: SuspensionReasonCode and RevocationReasonCode are described as 'enumerated values maintained by policy' but no specific allowed values are given. The exact value lists need to be specified.
  [lines 212-212] "SuspensionReasonCode and RevocationReasonCode are enumerated values maintained by policy."
- Temporal: Audit fields (CreatedAt, CreatedBy, UpdatedAt, UpdatedBy) are required on relationship entities and recommended on primary entities. These are not modeled as explicit fact types since they are cross-cutting audit concerns. It is unclear whether they should be formalized as part of the conceptual model or treated as infrastructure metadata.
  [lines 204-204] "We need CreatedAt, CreatedBy, UpdatedAt, UpdatedBy on all relationship entities. For primary entities, CreatedAt and UpdatedAt are required, actor fields recommended."

WARNINGS:

- Removed population for "User has UserStatus" that duplicates a value constraint.
- Removed population for "Account has AccountStatus" that duplicates a value constraint.
- Removed population for "UserAccountMembership has MembershipStatus" that duplicates a value constraint.
- Removed population for "UserAccountMembership has AccountRoleType" that duplicates a value constraint.
- Removed population for "Organization has OrgType" that duplicates a value constraint.
- Removed population for "AccountOrganizationLink has LinkStatus" that duplicates a value constraint.
- Removed population for "AccountOrganizationLink has LinkTransactionRole" that duplicates a value constraint.
- Removed population for "Invitation has InvitationStatus" that duplicates a value constraint.
- Removed duplicate constraint "Organization parentage hierarchy must be acyclic." (ring on Organization has parent Organization).
