# DECILE Outreach — Security Specification

## 1. Data Invariants
1. **User Scoping & Isolation**: Every record (`leads`, `campaigns`, `campaign_leads`, `accounts`, `suppressions`, `email_messages`, `settings`) MUST have an `ownerId` that strictly matches `request.auth.uid`.
2. **Identity Integrity**: Users can never query or manipulate records belonging to another workspace owner.
3. **No Unauthenticated Access**: Unauthenticated requests are rejected outright across all collections via default-deny.
4. **Relational Verification**: A campaign enrolment (`campaign_leads`) cannot be created unless the referenced `campaignId` and `leadId` exist and belong to the same `ownerId`.
5. **No State Bypasses**: Bounced or unsubscribed leads cannot be re-enrolled into active sending states.
6. **Input Boundaries**: All strings must have enforced maximum lengths (names <= 256, subjects <= 512, emails <= 254, bodies <= 8192) to prevent Denial of Wallet resource attacks.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Ghost Field Injection**: Attempt to create a lead with an unauthorized `isAdmin: true` attribute. Expected: PERMISSION_DENIED.
2. **Cross-Tenant Impersonation**: Attacker (UID `user_B`) attempts to insert a lead with `ownerId: "user_A"`. Expected: PERMISSION_DENIED.
3. **Cross-Tenant Lead Read**: Attacker (UID `user_B`) attempts to read a lead document owned by `user_A`. Expected: PERMISSION_DENIED.
4. **ID Poisoning / Denial of Wallet**: Document ID containing 2000 invalid characters. Expected: PERMISSION_DENIED.
5. **Campaign Lead Cross-Owner Hijack**: Attacker tries to enroll a lead from another user's database into their campaign. Expected: PERMISSION_DENIED.
6. **Immutability Breach**: Updating `ownerId` on an existing campaign to transfer ownership. Expected: PERMISSION_DENIED.
7. **Email Message Spoofing**: Injecting an `email_message` document where `fromEmail` is arbitrary without matching a valid owned sending account. Expected: PERMISSION_DENIED.
8. **Oversized Payload**: Submitting an email body exceeding 8KB. Expected: PERMISSION_DENIED.
9. **Blanket Query Scraping**: Attempting an unconstrained collection list without filtering by `ownerId == auth.uid`. Expected: PERMISSION_DENIED.
10. **Suppression Bypass**: Updating an unsubscribed lead back to `not_contacted` while an active suppression entry exists. Expected: PERMISSION_DENIED.
11. **Account Quota Spoofing**: Setting `dailyLimit: 999999` to bypass sending infrastructure limits. Expected: PERMISSION_DENIED.
12. **Unverified Email Authorization**: Writing with a simulated unverified token (`email_verified: false`). Expected: PERMISSION_DENIED.

## 3. Test Runner
Refer to `firestore.rules.test.ts` for automated evaluation against Firestore emulator suites.
