# Security Specification - مدیریت گیم‌نت پلاس

## Data Invariants
1. A **Session** must have a valid `consoleId` and its status can only transition from `running` to `completed`.
2. A **User** cannot change their own `tier`, `balance`, or `points` (only an admin or server process can).
3. A **Console**'s `id` must be alphanumeric.
4. An **Order** must have a `totalAmount` calculated from `items`.

## The "Dirty Dozen" Payloads (Forbidden Actions)
1. User updating their own `balance` field.
2. User creating a `Console` document.
3. User updating `price` of a `Product`.
4. Unauthorized user deleting another user's `Reservation`.
5. Setting `status` of a `Session` to `completed` without being the physical operator (admin only).
6. Injecting a massive string (1MB) as a `name` in `User`.
7. Spoofing `ownerId` in a `Reservation`.
8. Updating a `completed` session.
9. Creating an `Order` with negative `totalAmount`.
10. Listing all `User` profiles (PII Leak).
11. Reading `orders` of someone else.
12. Updating `email_verified` via client SDK.

## The Test Runner (Plan)
Tests will verify that `PERMISSION_DENIED` is returned for all non-admin write attempts on critical fields.
