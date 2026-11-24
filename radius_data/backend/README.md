# Green Radius Standalone Backend Service

## Endpoints List
| Method | Path | Roles Required | Response Shape | Implemented |
|---|---|---|---|---|
| POST | /auth/login | Public | `{ token, user }` | ✅ |
| POST | /auth/session | Public | `{ token, user }` | ✅ |
| GET | /auth/me | Authenticated | `RadiusAuthMe` | ✅ |
| POST | /auth/refresh | Authenticated | `{ token, user }` | ✅ |
| GET | /lines | Authenticated | `{ lines: [...] }` | ✅ |
| POST | /lines | SuperAdmin / Settings | `RadiusLine` | ✅ |
| PATCH | /lines/:id | SuperAdmin / Settings | `RadiusLine` | ✅ |
| GET | /dealers | Authenticated | `{ dealers: [...] }` | ✅ |
| POST | /dealers | Dealers Manage | `RadiusDealer` | ✅ |
| PATCH | /dealers/:uid | Dealers Manage | `RadiusDealer` | ✅ |
| POST | /dealers/:uid/wallet/topup | Dealers Manage | `{ dealer, entry, wallet_balance }` | ✅ |
| GET | /dealers/:uid/wallet/ledger | Authenticated | `{ ledger: [...] }` | ✅ |
| GET | /dealers/:uid/prices | Authenticated | `{ prices: [...] }` | ✅ |
| PUT | /dealers/:uid/prices | Dealers Manage | `{ prices: [...] }` | ✅ |
| GET | /staff | Authenticated | `{ staff: [...] }` | ✅ |
| POST | /staff | Members Manage | `TeamMemberRecord` | ✅ |
| PATCH | /staff/:uid | Members Manage | `TeamMemberRecord` | ✅ |
| DELETE | /staff/:uid | Members Manage | `{ success: true }` | ✅ |
| GET | /members | Authenticated | `{ members: [...] }` | ✅ |
| POST | /members | Members Manage | `TeamMemberRecord` | ✅ |
| PATCH | /members/:uid | Members Manage | `TeamMemberRecord` | ✅ |
| DELETE | /members/:uid | Members Manage | `{ success: true }` | ✅ |
| GET | /vlans | Authenticated | `{ vlans: [...] }` | ✅ |
| GET | /vlans/suggest | Authenticated | `VlanSuggestResponse` | ✅ |
| POST | /vlans | VLANs Manage | `RadiusVlan` | ✅ |
| PATCH | /vlans/:id | VLANs Manage | `RadiusVlan` | ✅ |
| DELETE | /vlans/:id | VLANs Manage | `{ success: true }` | ✅ |
| GET | /vlans/routeros-script | Authenticated | `RouterOsScriptResponse` | ✅ |
| GET | /users | Authenticated | `{ users: [...] }` | ✅ |
| GET | /users/main-users | Authenticated | `{ users: [...] }` | ✅ |
| POST | /users | Users Create | `RadiusUser` | ✅ |
| PATCH | /users/:id | Users Edit | `RadiusUser` | ✅ |
| DELETE | /users/:id | Users Delete | `{ success: true }` | ✅ |
| POST | /users/:id/renew | Users Renew | `{ success: true, newExpiry, ... }` | ✅ |
| POST | /users/:id/toggle | Users Toggle | `RadiusUser` | ✅ |
| POST | /users/:id/disconnect | Users Disconnect | `{ success: true }` | ✅ |
| GET | /packages | Authenticated | `{ packages: [...] }` | ✅ |
| POST | /packages | Packages Manage | `RadiusPackage` | ✅ |
| PATCH | /packages/:id | Packages Manage | `RadiusPackage` | ✅ |
| DELETE | /packages/:id | Packages Manage | `{ success: true }` | ✅ |
| GET | /vouchers | Authenticated | `{ vouchers: [...] }` | ✅ |
| POST | /vouchers/generate | Vouchers Manage | `Voucher[]` | ✅ |
| POST | /vouchers/redeem | Vouchers Manage | `{ success: true, voucher }` | ✅ |
| POST | /vouchers/delete | Vouchers Manage | `{ success: true }` | ✅ |
| GET | /payments | Authenticated | `{ payments: [...] }` | ✅ |
| POST | /payments | Payments Create | `Payment` | ✅ |
| GET | /nas | Authenticated | `{ nas: [...] }` | ✅ |
| POST | /nas | NAS Manage | `Nas` | ✅ |
| PATCH | /nas/:id | NAS Manage | `Nas` | ✅ |
| DELETE | /nas/:id | NAS Manage | `{ success: true }` | ✅ |
| POST | /nas/:id/ping | NAS Manage | `{ status, latencyMs }` | ✅ |
| GET | /stats | Authenticated | Server Stats Record | ✅ |
| GET | /logs | Authenticated | `{ logs: [...] }` | ✅ |
| POST | /sms/send | Authenticated | `{ success: true }` | ✅ |
| GET | /settings | Authenticated | `RadiusSettings` | ✅ |
| PUT | /settings | Settings Manage | `RadiusSettings` | ✅ |
