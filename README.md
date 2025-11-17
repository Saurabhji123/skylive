# Skylive Cinema

Skylive Cinema is a private watch-party stack composed of a Next.js frontend, an Express/Socket.IO backend, and a shared TypeScript package. The code in this repository is provided strictly for the owner’s deployment and maintenance workflows.

## Repository Layout (for reference only)

- `frontend/` – user-facing Next.js 16 application destined for Vercel.
- `backend/` – API and signaling service written in TypeScript for Render.
- `packages/shared/` – shared DTOs and utilities reused by both layers.

## Configuration Notes

- Runtime secrets (database URIs, JWT keys, etc.) **must stay outside version control**. Use the `.env.example` files in `backend/` and `frontend/` as templates and store the real values privately.
- Production deployments are manually provisioned on Render (backend) and Vercel (frontend). This repository deliberately omits a turnkey deployment script to deter unauthorized replication.
- When domains or infrastructure change, ensure CORS origins, cookie security flags, and Socket.IO endpoints are updated accordingly.

## Compliance & Enforcement

- Skylive Cinema assets, copy, and source code are protected under copyright. Unauthorized redistribution, resale, or re-hosting is expressly prohibited.
- Attempts to clone, white-label, or derive competing services without written approval will trigger removal notices, DMCA complaints, and suspension requests with hosting/CDN providers. Damages will be pursued when necessary.
- Trafficking the brand identity (logos, UI, marketing copy) or using the codebase to impersonate Skylive is a policy violation and may incur contractual penalties in addition to statutory damages.
- Contributors must comply with internal policies and applicable laws. Violations—such as harvesting user data, bypassing access controls, or modifying safeguards—can result in immediate access revocation, account termination, and legal action.

## Reporting & Support

Operational issues or suspected abuse should be reported through the private support channels documented internally. Do not disclose sensitive incident details in public trackers.
# skylive
