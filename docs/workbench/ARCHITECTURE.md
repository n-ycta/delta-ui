# Workbench v1 — implementation boundary

Reviewed Core platform/identity/peer/host contracts, UI SDK client/channel, host projection, existing dashboards/apps/pages, attached TODO (2026-10-16), and available plugin repositories.

## Capability map

- Core: real authentication, peers, supervised capabilities, installation. Pairing is not data sync.
- Storage: real file/Postgres records and owner documents. No implicit backend migration.
- Type: real OS-specific aggregates and explicit permissions. Not available on arbitrary devices.
- MCP: real scoped gateways. Not an implemented AI agent harness.
- Web: real administrative projection. Desktop/Android: thin hosts sharing delta-ui.
- Updater/Provision/Observability: real headless services. Not OS-binary self-update, VPN or complete uptime reporting.
- Media: real local/direct/RSS MVP, limited platform decoding/CORS. YouTube/Nostr/Blossom adapters and cross-device sync remain future work.
- Send/Sync/Health/Connect/Flow/Scope/Grab: roadmap, no available implementation repositories. No pretend chat, Samsung Health, graph executor or downloader in the UI.

## Alternatives reviewed

1. Fixed responsive dashboard: simple but cannot compose applications.
2. Pure desktop windows: flexible but weak on phones and structured workflows.
3. Recursive composition tree + canvas: tabs/splits for phones and structured work; windows when useful. Selected. Canvas is optional, not a mandatory desktop metaphor.

## Terms and contracts

Profile = identity/display profile. Application = saved interface. Workspace = collection of applications and active layout. Versioned JSON contains only visual configuration, never credentials, permission grants, media bytes or notes. View instances have stable IDs. Splits have two children; tabs retain inactive children mounted; canvas stores independent window geometry and camera. App references must form a DAG. Resource limits: 32 apps, 240 nodes, 500 KB export, bounded depth. Restore is undoable.

Built-in system pages reuse the authenticated API and existing capabilities. Each embedded page has its own React root/MemoryRouter, not a nested router in the same tree. Portable plugins retain isolated origins, source/origin/nonce checks and explicit grants in the existing Plugin UI SDK. The builder never executes arbitrary JS, accepts raw HTML/CSS or changes auth. Hidden views are visual only; security/recovery controls live outside editable trees.

The first integration is an explicit `/workbench` route, not an automatic destructive replacement of the existing Console. Standalone HTML provides actual local notes, file playback, layout editing and persistence; system screens explicitly require Core. Production uses real system screens and installed apps. Existing auth remains outside the workbench. Layouts currently persist per browser/device with previous-version backup and portable export; node/profile storage and synchronization are NOT claimed. Local files/notes are separate and never exported with the layout.

Four starters: Console / Media / Studio / Canvas. Four scoped themes: Paper and Daylight (light), Graphite and Midnight (dark). Plugin SDK v1 still receives light/dark; additional theme semantics are host-local. Full official Phosphor regular pool is bundled offline, MIT notice retained.
