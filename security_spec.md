# Security Specification - Multi-Tenant GTS Service Registry

## Data Invariants
1. **Tenant Isolation**: Every resource (Complaint, Client, Chat, Notification) must belong to a `dealerId`.
2. **Identity Integrity**: Users can only create resources with their own `userId` or their tenant's `dealerId`.
3. **Role-Based Access**: 
   - `super_admin`: Total system access.
   - `dealer`: Access restricted to their own `tenantId` (their `uid`).
   - `admin`/`member`: Access restricted to their parent dealer's `tenantId`.
4. **Immutability**: Once created, `dealerId` and `id` must not be modified.

## The "Dirty Dozen" Payloads

1. **Attempted Identity Spoofing**: Create a complaint as User A but marking it as created by User B.
2. **Cross-Tenant Read**: Dealer A trying to `get` a complaint belonging to Dealer B.
3. **Cross-Tenant Write**: Member of Dealer A trying to `create` a client for Dealer B's network.
4. **Elevation Attack**: Member attempting to update their own `role` to `admin` or `super_admin`.
5. **Orphaned Write**: Creating a member with a non-existent `dealerId`.
6. **Shadow Field Injection**: Adding `isVerified: true` hidden field to a user profile to bypass future checks.
7. **Resource Exhaustion**: Sending a 1MB string as a `customerName`.
8. **Terminal State Bypass**: Updating a `complete` complaint back to `pending` without proper authorization.
9. **Global Config Poisoning**: Non-super_admin attempting to modify `config/app`.
10. **Chat Scraping**: Listing all chat messages from all dealers in one query.
11. **Spoofed Dealer Creation**: Regular admin attempting to create a new dealer account.
12. **Line Code Hijacking**: Updating a dealer's `lineCode` to match another dealer's code.

## The Guardrail Logic
Access is derived from the User Profile.
We define `getTenantId()` in rules to resolve the user's scope.
- If user is `dealer`, scope is `uid`.
- If user is `admin`/`member`, scope is `dealerId`.
- If user is `super_admin`, scope is global.

