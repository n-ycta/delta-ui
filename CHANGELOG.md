# Changelog

## 0.3.1

- Reflow the mobile plugin catalog into fluid cards, a two-column tab selector and a dedicated search/filter toolbar at 320px and wider.
- Center segmented-control icons explicitly and provide 44px touch targets.
- Keep the mobile dock manager reachable with a short label, aligned navigation slots and a separate now-playing row.
- Remove the unrelated history-service notice from the catalog; keep history guidance on history screens.
- Add RU/EN light/dark browser checks for mobile overflow, icon centers, hit-testing, installation controls, manager and hidden-dock reveal.

## 0.3.0

- Update the Media catalog to the verified 0.3.5 UI package.
- Allow only the six explicit offline-cache capabilities through the Media UI broker; keep unrelated operations denied.

## 0.3.0 — shell and workbench

- One global dock outside every app: Console, installed apps and desktops; configurable position (left/right/top/bottom/hidden), size, labels, order and pinning; context menu (open, pin, rename, duplicate, delete, stop, uninstall); bottom bar on phones.
- “All apps” manager: installed apps appear automatically after installation, catalog install/update, desktop previews and template gallery, dock constructor, theme.
- Apps and desktops are separate concepts; Console and Media are no longer “desktops”. New “Home” desktop with clock, quick launch, now playing and tips.
- Running apps live above the router: music keeps playing when switching apps, desktops or Console pages; mini-player in the dock.
- One global theme for the system and apps: Catppuccin Latte (Manrope), Gruvbox Light (Golos Text + Literata), Catppuccin Mocha (Onest), Tokyo Night (JetBrains Mono); tokens are passed to app frames (`applyThemeTokens`).
- Dashboard “App” widget embeds an installed app with the usual move/resize.
- SDK: media session (`reportMedia`, `onMediaCommand`) and catalog-governed intents between apps (`sendIntent`, `onIntent`).
- Fix: the launcher “Apps” and “Settings” buttons opened the same dialog; distinct icons for Console, desktops and templates.
- Fix: the toast container no longer covers top-right controls; overlays are anchored to the stage, above the global dock.
- Catalog: Delta Media 0.2.0 (player, receives `media.play`/`media.enqueue`) and new source apps Delta YouTube, Delta SoundCloud, Delta Spotify 0.1.0 (send those intents). App CSP allows the official SoundCloud and Spotify embeds.

## 0.1.3

- Require authenticated Web identity before mounting management screens.
- Add explicit key/token/setup sign-in, disable implicit production demo mode and complete first-owner key enrollment.
- Keep browser private-key derivation/signatures local and clear key buffers after use.

- Full shared UI over credential-private native IPC, without a Web server.
- Explicit service-node selection, QR invitations and system file/share adapters.
- Android Keystore-backed profile/documents and independent foreground-service runtime.
- Desktop tray, login startup, notifications and private bundled plugin runtime.
- Native service routing regression tests; no HTTP fallback.


## [v0.1.2]

- Keep dependency IDs readable when diagnostic badges and recovery actions wrap on mobile.
- Clear capability availability after a failed refresh rather than retaining stale ready state.

## [v0.1.1]

- Add declarative dependency diagnostics, feature gates and optional installation selection.
