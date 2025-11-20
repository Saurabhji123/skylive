# Skylive Cinema

> Private watch-party infrastructure maintained for first-party deployments only.

## Overview

- Browser-native co-watching with synchronized playback, reactions, and whiteboard tools.
- Next.js 16 frontend paired with an Express and Socket.IO signaling layer.
- Shared TypeScript contracts that keep the API, WebRTC flows, and UI in lockstep.

## Architecture at a Glance

| Layer | Stack | Purpose |
| --- | --- | --- |
| Frontend | Next.js 16, React Server Components, Tailwind CSS | Hosts the cinematic client experience for browser sessions. |
| Backend | Express, Socket.IO, MongoDB | Provides REST+WebSocket APIs, auth, analytics, and TURN orchestration for your deployment targets. |
| Shared | TypeScript package, Zod schemas | Centralizes DTOs, validation, and constants across services. |

Repository layout for reference:

- `frontend/` – public-facing application, including shared UI primitives and hooks.
- `backend/` – API surface, signaling server, and background tasks.
- `packages/shared/` – versioned types and utilities consumed by both runtimes.

## Environment & Security

- Real secrets (JWT keys, TURN credentials, database URIs) **must never** enter version control. Use the provided `.env.example` files and keep live values in private vaults.
- Production deployments are provisioned manually per environment; no automated scripts are provided intentionally.
- Update CORS origins, secure cookies, and Socket.IO endpoints whenever domains or infrastructure shift.
- Run the backend with hardened TLS termination and monitor TURN usage to prevent abuse.


## Operational Guidelines

- Follow internal runbooks for scaling, log redaction, and incident response. Never expose customer content in debug logs or analytics exports.
- Run health checks (`pnpm lint`, `pnpm test`, targeted load sweeps) before shipping major changes to avoid regressions in session stability.
- Archived builds and release artifacts should remain within controlled storage; do not mirror binaries publicly.

## Compliance & Enforcement

- All Skylive Cinema assets, code, and copy are protected by copyright. Unauthorized redistribution, resale, or re-hosting is forbidden.
- Attempts to clone, white-label, or derive competing services without written approval will trigger removal notices, DMCA complaints, and service suspensions. Damages may be pursued when warranted.
- Impersonating Skylive through logos, UI, or communications violates platform policy and can incur contractual penalties in addition to statutory remedies.
- Personnel must adhere to internal policies and applicable laws. Improper data harvesting, access control bypasses, or safeguard tampering can result in immediate access revocation and legal escalation.

## Collaboration & Contact

- Strategic partnerships, security disclosures, and collaboration requests: `skylivecinema@gmail.com`.
- Operational issues or suspected abuse should continue through private support channels documented internally. Avoid sharing sensitive incident details in public trackers.
