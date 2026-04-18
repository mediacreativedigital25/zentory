# Security Specification - Tenant Isolation

## Data Invariants
1. A **User** must belong to exactly one **Tenant** (unless they are a superadmin).
2. A **User** cannot change their own `tenantId` or `role`.
3. All data (Products, Transactions, Orders, etc.) must have a `tenantId` that matches the `tenantId` of the authenticated user.
4. Users cannot view or modify data belonging to another `tenantId`.
5. Superadmins have global access.
6. Tenant owners (admins) can manage users within their own tenant but cannot change their own tenant affiliation.

## The "Dirty Dozen" Payloads (Athenticated as User A, Tenant 1)

1. **Profile Hijack**: `update /users/userA { tenantId: 'tenant2' }` -> Should be DENIED.
2. **Role Escalation**: `update /users/userA { role: 'superadmin' }` -> Should be DENIED.
3. **Cross-Tenant Product Create**: `create /products/p_new { tenantId: 'tenant2', name: 'Stolen' }` -> Should be DENIED.
4. **Cross-Tenant Transaction View**: `get /transactions/t_tenant2` -> Should be DENIED.
5. **Cross-Tenant User View**: `get /users/userB_tenant2` -> Should be DENIED (even if staff of tenant 1).
6. **Malicious ID Injection**: `create /products/INVALID_ID_~!@#$%^&*() { ... }` -> Should be DENIED (isValidId check).
7. **Shadow Field Injection**: `create /products/p1 { ..., isVerifiedBySystem: true }` -> Should be DENIED (affectedKeys check).
8. **Tenant Settings Hijack**: `update /tenants/tenant2 { ... }` -> Should be DENIED.
9. **Inventory Poisoning**: `update /products/p1 { stock: -99999 }` -> Should be DENIED (if we have min size checks).
10. **Transaction Amount Tamper**: `update /transactions/t1 { amount: 0 }` (when it was 100) -> Should be DENIED (if only specific keys allowed).
11. **Timestamp Spoofing**: `create /products/p1 { ..., createdAt: '2020-01-01' }` (client-side timestamp) -> Should be DENIED (must use request.time).
12. **Blind List Query**: `list /products where tenantId == tenant2` -> Should be DENIED by rule check on resource.data.

## Test Runner logic (to be implemented in rules)
The rules will be verified against these scenarios.
