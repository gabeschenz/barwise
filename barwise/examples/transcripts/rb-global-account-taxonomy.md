Facilitator: I want to capture a complete domain model for RB Global account taxonomy. Let's start with the core concepts.

Domain Architect: At the center we have User, Account, and Organization. In this domain, Organization is the same as a transacting entity. People often say "Org" in system conversations and "transacting entity" in legal or finance conversations.

Facilitator: So Org and transacting entity are synonyms here?

Domain Architect: Yes, for this transcript treat them as the same concept.

Facilitator: Great. What is a User?

Domain Architect: A User is a human identity that can authenticate and act in our digital platforms. A user has one global user profile and can access multiple accounts.

Facilitator: How is a User identified?

Domain Architect: By a globally unique UserId issued by the identity platform. We also store primary email as a login identifier, but UserId is the canonical identifier.

Facilitator: Can email change?

Domain Architect: Yes, email can change. UserId is immutable. We also keep user status values: active, suspended, invited, and deactivated.

Facilitator: What is an Account in your terminology?

Domain Architect: Account is a commercial participation container. Think of it as the business-facing account context where permissions, preferences, and transaction capabilities are managed for one or more organizations.

Facilitator: How is Account identified?

Domain Architect: By AccountId, globally unique. It also has an AccountNumber used for support and invoicing displays. AccountNumber is unique too.

Facilitator: Relationship between User and Account?

Domain Architect: One user can belong to many accounts, and one account can have many users. So it is many-to-many.

Facilitator: Is that direct, or does it have attributes?

Domain Architect: It has attributes, so we model it as membership. UserAccountMembership records the user's role and lifecycle within an account.

Facilitator: What identifies a UserAccountMembership?

Domain Architect: Uniqueness is by (UserId, AccountId). A user can have at most one active membership row per account.

Facilitator: You said "active membership row." Can historical rows exist?

Domain Architect: Yes. We track membership history through EffectiveFrom and EffectiveTo timestamps plus MembershipStatus. For strict uniqueness, we enforce one current row where EffectiveTo is null.

Facilitator: What are membership statuses?

Domain Architect: pending_invite, active, suspended, revoked.

Facilitator: And account roles?

Domain Architect: Typical account roles are account_owner, account_admin, account_member, billing_admin, and read_only.

Facilitator: Is role single-valued?

Domain Architect: A user can have multiple roles in the same account. So role assignment is another fact: UserAccountMembership has RoleType, many-to-many if we normalize it.

Facilitator: Understood. Now the Account to Organization relationship.

Domain Architect: One account can be linked to multiple organizations, and one organization can be linked to multiple accounts. This is also many-to-many.

Facilitator: Why would one organization be linked to multiple accounts?

Domain Architect: Common reasons are regional operations, merger transitions, or separation of procurement and disposal business flows while preserving one legal transacting entity.

Facilitator: Why would one account include multiple organizations?

Domain Architect: Holding companies often want centralized access across subsidiaries. They use one account context that can transact on behalf of several legal entities.

Facilitator: Do we model that relation directly?

Domain Architect: We model it via AccountOrganizationLink. It carries operational scope and lifecycle data.

Facilitator: What identifies an Organization (transacting entity)?

Domain Architect: OrganizationId is the platform identifier. We also keep LegalEntityIdentifier where available, TaxId in some jurisdictions, and LegalName.

Facilitator: Are all of those mandatory?

Domain Architect: OrganizationId and LegalName are mandatory. LegalEntityIdentifier and TaxId are conditional based on country and business process.

Facilitator: Any organization classification?

Domain Architect: Yes. OrgType values include buyer, seller, logistics_partner, and internal_entity. Multiple types can apply to one organization.

Facilitator: So OrgType is multi-valued per organization?

Domain Architect: Correct. Organization to OrgType is many-to-many.

Facilitator: To confirm, buyer orgs and seller orgs are first-class in this model?

Domain Architect: Yes. Buyer and seller are explicit organization types. An organization may be buyer-only, seller-only, or both depending on its business functions.

Facilitator: What if the same legal org is both buyer and seller, but the business wants those treated separately?

Domain Architect: That is a valid requirement. Canonically it can still be one Organization (one legal transacting entity), but we may model separate participation profiles for that organization: a BuyerProfile and a SellerProfile.

Facilitator: So one Organization can map to two role-specific profiles?

Domain Architect: Exactly. This preserves legal identity while allowing operational separation, separate onboarding states, independent policy checks, and distinct permissions.

Facilitator: Are those profiles mandatory?

Domain Architect: Not always. In simpler cases, OrgType plus link transaction role is enough. Profiles are introduced when buyer and seller need separate lifecycle or compliance controls.

Facilitator: Is transaction context aware of that?

Domain Architect: It should be. When an account acts for an organization, downstream workflows may require that organization to carry buyer capability, seller capability, or both.

Facilitator: Back to AccountOrganizationLink. What attributes matter?

Domain Architect: LinkStatus (active, pending_verification, suspended, terminated), EffectiveFrom, EffectiveTo, and OperatingRegion.

Facilitator: Does the link also capture whether the account can act as buyer or seller for that organization?

Domain Architect: Yes, that's recommended. We can model one or more LinkTransactionRole values on AccountOrganizationLink, with allowed values buyer and seller. That lets one account-org link support buyer, seller, or both scopes.

Facilitator: If profiles are enabled, does the link point to profile-level scope too?

Domain Architect: It can. In advanced mode, AccountOrganizationLink can be constrained to BuyerProfile, SellerProfile, or both, instead of only broad organization-level role flags.

Facilitator: Any uniqueness constraints?

Domain Architect: One account can have at most one current active link to a given organization per operating region. Historical rows are allowed.

Facilitator: Does "current" again mean EffectiveTo is null?

Domain Architect: Yes.

Facilitator: Is every account required to link to at least one organization?

Domain Architect: Yes for transacting accounts. But we also allow setup accounts in pre-onboarding state with zero organizations temporarily.

Facilitator: Should that be represented as a status?

Domain Architect: Exactly. AccountStatus includes setup, active, suspended, closed. If status is active, at least one active AccountOrganizationLink must exist.

Facilitator: Nice conditional rule. What about user access to organizations?

Domain Architect: Access is derived. Users do not link directly to organizations in the base model. A user has organization access if they are an active member of an account and that account has an active link to the organization.

Facilitator: Is direct User-Organization assignment ever needed?

Domain Architect: In some advanced scenarios yes, for restriction overrides. We can model optional UserOrganizationScope as a narrowing layer.

Facilitator: Explain narrowing layer.

Domain Architect: Without narrowing, membership in an account grants visibility to all organizations linked to that account. With narrowing, a user can be limited to a subset of those organizations.

Facilitator: So by default full inherited scope, optionally reduced?

Domain Architect: Correct.

Facilitator: How do invitations work?

Domain Architect: An existing account admin sends an invitation to an email for a specific account. Invitation has InvitationId, target email, inviter user, account, issued timestamp, expiry timestamp, and invitation status.

Facilitator: Invitation status values?

Domain Architect: issued, accepted, expired, revoked.

Facilitator: What happens when invitation is accepted?

Domain Architect: It produces an active UserAccountMembership. If the email already maps to an existing user, we attach membership to that user. If not, a new user is created and then membership is attached.

Facilitator: Is there any uniqueness around invitations?

Domain Architect: At most one non-terminal invitation (issued) can exist for the same (target email, account).

Facilitator: Let's cover tenancy boundaries.

Domain Architect: Security and data partitioning are enforced at account boundary first, then by organization scope within account where enabled.

Facilitator: Can two accounts share users?

Domain Architect: Yes. A single user identity can be present in many accounts. That is common for consultants and parent-company operators.

Facilitator: Can two accounts share organizations?

Domain Architect: Yes, as discussed. That is an intentional many-to-many relationship.

Facilitator: Let's discuss canonical names because this can get messy.

Domain Architect: Yes. We standardize terms:

- User = person identity
- Account = access and transaction container
- Organization = transacting entity (legal/operating party)
- Membership = user-account relationship with lifecycle and roles
- Link = account-organization relationship with lifecycle

Facilitator: Any term we should avoid?

Domain Architect: "Customer" is overloaded across teams. In this service we avoid it in the canonical model because sometimes customer refers to account and sometimes to organization.

Facilitator: Good call. What identifiers are immutable?

Domain Architect: UserId, AccountId, OrganizationId, InvitationId are immutable. AccountNumber is immutable once account status becomes active.

Facilitator: What about soft deletion?

Domain Architect: We do not physically delete primary entities. We use status + lifecycle timestamps. Closed accounts and deactivated users remain for audit.

Facilitator: Audit requirements?

Domain Architect: We need CreatedAt, CreatedBy, UpdatedAt, UpdatedBy on all relationship entities. For primary entities, CreatedAt and UpdatedAt are required, actor fields recommended.

Facilitator: Any compliance constraints?

Domain Architect: Access grants and revocations must be traceable. For regulated regions, we also need reason codes when membership is suspended or revoked.

Facilitator: Is reason code modeled as a value list?

Domain Architect: Yes, SuspensionReasonCode and RevocationReasonCode are enumerated values maintained by policy.

Facilitator: Are there hierarchy rules for organizations?

Domain Architect: Optional. Some organizations have parent-child hierarchy. We model OrganizationParentage with child organization and parent organization, effective dates, and uniqueness of one active parent per child.

Facilitator: Is parentage required for all organizations?

Domain Architect: No, optional.

Facilitator: Any hierarchy for accounts?

Domain Architect: Not in v1. Accounts are flat in this service.

Facilitator: Let's define critical business rules explicitly.

Domain Architect: Core rules:

1. Every User is identified by exactly one UserId.
2. Every Account is identified by exactly one AccountId.
3. Every Organization is identified by exactly one OrganizationId.
4. User and Account are many-to-many through Membership.
5. Account and Organization are many-to-many through Link.
6. Active Account requires at least one active AccountOrganizationLink.
7. A user can transact for an organization only if access is derived from active Membership plus active Link, and optional narrowing scope does not exclude it.
8. One active Membership per (User, Account).
9. One active Link per (Account, Organization, OperatingRegion).
10. Membership and Link maintain full effective-dated history.
11. Buyer-facing workflows require organization buyer type and corresponding link transaction role buyer.
12. Seller-facing workflows require organization seller type and corresponding link transaction role seller.
13. One Organization may support both buyer and seller capabilities simultaneously.
14. When policy requires separation, buyer and seller capabilities may be represented as distinct role-specific profiles under the same Organization.

Facilitator: Can a membership exist for a closed account?

Domain Architect: Historical rows can exist, but no active membership can exist if account status is closed.

Facilitator: Can a link exist for a closed account?

Domain Architect: Historical rows yes, active link no.

Facilitator: Any constraints around account owners?

Domain Architect: Every active account must have at least one active membership with role account_owner.

Facilitator: Can there be multiple owners?

Domain Architect: Yes, at least one, potentially many.

Facilitator: How do you model preferred contact for an organization within an account?

Domain Architect: Optional fact: AccountOrganizationLink may reference one PrimaryContactMembership. It must point to a membership in the same account.

Facilitator: Should the primary contact also have organization access?

Domain Architect: Yes, either inherited full scope or explicitly scoped to that organization.

Facilitator: What about API integration identities, non-human actors?

Domain Architect: Out of scope for this transcript. This taxonomy is for human user access. Service principals can be added later as a separate actor type.

Facilitator: Any known ambiguities we should capture as follow-up questions?

Domain Architect: Yes, several:

1. Whether Organization should be mandatory at account creation for all onboarding channels.
2. Whether OperatingRegion should be required on every AccountOrganizationLink or only for cross-border organizations.
3. Whether direct UserOrganizationScope should be part of v1 or deferred.
4. Whether account_owner role must be unique per account or can remain many.

Facilitator: Final check. If I draw this, I should show User 1-to-many Membership, Account 1-to-many Membership, Account 1-to-many Link, Organization 1-to-many Link, and therefore User many-to-many Account and Account many-to-many Organization.

Domain Architect: Exactly. And Organization is your transacting entity concept.
