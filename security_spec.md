# Security Specification

## Data Invariants
1. **User Membership**: Users can only access data if they are part of the system.
2. **Dealer Isolation**: Users in a dealer network should only see complaints and clients belonging to their `dealerId`. (Note: The current app fetches all users for "login profiles", which we should carefully secure).
3. **Complaint Integrity**: Complaints must have a valid status and be created with a server timestamp.
4. **Message Ownership**: Chat messages must have a `senderId` matching the authenticated user.

## The "Dirty Dozen" Payloads
1. **Unauthenticated List Users**: Attempt to `list` /users without being logged in.
2. **Identity Spoofing**: Registering a user with `role: 'super_admin'` as a member.
3. **Draft Bypass**: Updating a complaint's `status` to 'complete' by a non-admin.
4. **Account Hijack**: Updating another user's password or profile.
5. **PII Leak**: Reading all user profiles as a regular member.
6. **Orphaned Complaints**: Creating a complaint with a non-existent `memberId`.
7. **Cross-Dealer Leak**: A dealer reading another dealer's complaints.
8. **Message Spoofing**: Sending a message with a someone else's `senderId`.
9. **Alarm Sabotage**: Triggering the alarm anonymously.
10. **Config Tampering**: Modifying branding or operational categories as a member.
11. **Shadow Field Injection**: Adding `isAdmin: true` to a Client document.
12. **Timestamp Forgery**: Providing a backdated `createdAt` for a complaint.

## The Test Runner
(A separate test file would verify these, but for now we focus on the rules logic).
