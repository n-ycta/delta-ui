# Workbench v1 — implementation boundary

Reviewed Core platform/identity/peer/host contracts, UI SDK client/channel, host projection, existing dashboards/apps/pages, attached TODO (2026-10-16), and available plugin repositories.

## Capability map

- Core: real authentication, peers, supervised capabilities, installation. Pairing is not data sync.
- Storage: real file/Postgres records and owner documents. No implicit backend migration.
- Type: real OS-specific aggregates and explicit permissions. Not available on arbitrary devices.
- MCP: real scoped gateways. Not an implemented AI agent harness.
- Web: real administrative projection. Desktop/Android: thin hosts sharing delta-ui.
- Updater/Provision/Observability: real headless services. Not OS-binary self-update, VPN or complete uptime reporting.
- Media: real local/direct/RSS playback and cliamp public radio presets/catalog search, limited platform decoding/CORS. YouTube/Nostr/Blossom adapters and cross-device sync remain future work.
- Send/Sync/Health/Connect/Flow/Scope/Grab: roadmap, no available implementation repositories. No pretend chat, Samsung Health, graph executor or downloader in the UI.

## Alternatives reviewed

1. Fixed responsive dashboard: simple but cannot compose applications.
2. Pure desktop windows: flexible but weak on phones and structured workflows.
3. Recursive composition tree + canvas: tabs/splits for phones and structured work; windows when useful. Selected. Canvas is optional, not a mandatory desktop metaphor.

## Terms and contracts

Profile = identity/display profile. Application = saved interface. Workspace = collection of applications and active layout. Versioned JSON contains only visual configuration, never credentials, permission grants, media bytes or notes. View instances have stable IDs. Splits have two children; tabs retain inactive children mounted; canvas stores independent window geometry and camera. App references must form a DAG. Resource limits: 32 apps, 240 nodes, 500 KB export, bounded depth. Restore is undoable.

Built-in system pages reuse the authenticated API and existing capabilities. Each embedded page has its own React root/MemoryRouter, not a nested router in the same tree. Portable plugins retain isolated origins, source/origin/nonce checks and explicit grants in the existing Plugin UI SDK. The builder never executes arbitrary JS, accepts raw HTML/CSS or changes auth. Hidden views are visual only; security/recovery controls live outside editable trees.

The first integration is an explicit `/workbench` route, not an automatic destructive replacement of the existing Console. Standalone HTML provides local notes, file playback, editing, persistence and the original Console screens using an explicitly labeled mock adapter. It does not connect to a real node or overwrite connection settings. Production uses the original authenticated system screens and installed apps. Existing auth remains outside the workbench. Layouts persist locally with previous-version backup and portable export. Connected hosts additionally support explicit owner-private node save/load with revision conflict checks and a 48 KB limit. This is manual persistence, not automatic cross-device synchronization. Local files/notes are separate and never exported with the layout.

Four starters: Console / Media / Studio / Canvas. Four scoped themes: Paper and Daylight (light), Graphite and Midnight (dark). Plugin SDK v1 still receives light/dark; additional theme semantics are host-local. Full official Phosphor regular pool is bundled offline, MIT notice retained.

## Reuse and controls

The complete original Console remains available, including plugins, node details, events, dashboards, contracts, access, keys and settings. Existing individual dashboard widgets can be composed through the original WidgetFrame renderer and editor; edits affect the linked dashboard. Home heading/date/description and the summary strip have separate visibility/text settings and composable fragments.

The tree renderer, outline, appearance inspector, shared controls, persistence, SDK contribution schema and plugin surfaces are separate modules. React and vanilla Media controls share the same visual contract: custom keyboard-accessible popup lists, styled checkbox states, bounded scrolling and responsive touch controls. See `../sdk/UI-SURFACES.md` for the shared-plugin-instance boundary.

## Transient host controls and dock

The host launcher is collapsed to one compact button by default. Full Console embeds it in the normal top bar; frameless apps receive a small corner affordance. It opens only on demand and closes on Escape or outside pointer input. The button can be hidden in settings. Ctrl/Cmd+Shift+Space always recalls it; Ctrl/Cmd+Shift+E toggles editing and Ctrl/Cmd+Shift+R opens settings. The hidden-button preference is local host UI state, not part of the exported application tree. Recovery controls never become removable tree nodes.

Dock is an additional desktop/mobile navigation choice, with icon-only app launchers and an active indicator. Its floating appearance reserves a layout row, rather than covering media playback or charts. Side/top/bottom/hidden options remain supported. A mixed integration test composes a real isolated Media radio surface and an original dashboard time-series widget, exercises audio playback, then verifies dock layout and phone overflow. It uses explicit mock statistics and a test host adapter, not a live user node.

## Embedded responsive layout

System surfaces expose named CSS inline-size containers. Legacy forms, side
grids, event rows and Console navigation respond to their own pane rather than
the outer screen. Workbench base controls use zero-specificity exclusions so
component navigation and outline styling are not overridden by generic controls.
