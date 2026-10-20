# Changelog

## 0.3.5

- Publish verified LifeOS 0.3.1 with one independent app shell, native Delta controls and thirteen dashboard surfaces.
- Keep LifeOS in the persistent dock/FrameHost app-switch lifecycle like Media, separately from Console.

## 0.3.4

- Pin the reproducible, CI-verified LifeOS 0.2.1 release.
- Correct mobile widget-picker acceptance for the whole app plus thirteen named surfaces.

## 0.3.3

- Replace the retired Vector catalog entry with Delta LifeOS 0.2.0 and thirteen composable surfaces.
- Grant only explicit LifeOS capabilities and deny retired Vector access.
- Migrate workbench app identities with a backup while preserving widget geometry and notes.

## 0.3.2

- Preserve the authenticated shell through transient Web restarts; distinguish actual authorization rejection and localize reconnect feedback.
- Acknowledge update actions immediately, refresh active jobs every second, group components in collapsible node sections, highlight progress and expose bounded cross-node parallelism when supported.
- Preserve a single plugin frame across visible surfaces and suppress stale already-open placeholders.
- Add screen-scale magnetic window snapping with alignment guides and Alt bypass; commit layout changes only at gesture end.
- Add Studio address/search and back/forward/reload controls, with an external-browser fallback for sites that refuse framing.
- Back up and migrate only redundant whole-app Console/Media desktops; retain customized arrangements.
- Update the verified Media UI catalog to 0.3.6 and permit the explicit browse capability.
- Add actual-component reconnect, update, snapping and frame-ownership browser regressions.

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
