# Composable application surfaces (v1)

Applications may declare `ui: {version: 1, surfaces: [...]}` in their installed manifest. This is presentation metadata, not a permission request or executable extension. The root host discovers it through the authenticated installed-app list and validates it with `@delta/ui/sdk/surfaces`. Older apps without this field remain launchable as whole applications.

Each surface declares a stable `id`, localized `name` (`en` required, `ru` optional), bundled Phosphor `icon`, `kind` (`page`, `panel`, `widget`), `minWidth`, `minHeight`, `instance: "shared"`, and an optional `requires` list. IDs are lowercase tokens; names and lists are bounded; duplicate IDs, arbitrary URLs, code, grants and unknown keys are rejected. Minimum sizes are descriptive hints in v1, not a guarantee of every layout's usability. Requirements are displayed metadata, not an automatic installer or capability grant.

The saved tree refers to `application.id#surface-id`. The host launches the installed application on its isolated origin. Initial URL parameters include `surface`, `chrome=0`, language, theme and the host origin. After the existing SDK handshake, the host sends `{type: "delta:presentation", channel, context: {appId, surface, language, theme}}`. The app must verify the parent source, exact origin and initialized channel before applying presentation changes. Changes must not replace the player's runtime, storage, or SDK broker. No credential is included.

## Shared-instance boundary

V1 supports one live runtime/iframe per application ID. Several layout slots can reference it, but only the selected visible slot owns the frame. Other slots show an explicit shared-instance action. Switching surfaces reuses the same frame and playback. Independent simultaneous plugin panes are **not implemented** and `instance: "independent"` is rejected. This prevents a promise of simultaneous panels that the host cannot honor. A later protocol version can add isolated instances with explicit shared state and resource limits.

Composition is declared by the application author, never inferred by scraping arbitrary DOM. Surface adapters remain app-owned modules. Existing app permissions, origin isolation, channel checks, install integrity and owner authorization remain unchanged. Hiding a surface does not revoke its capability; the builder warns about hidden functionality. Security and recovery routes remain outside the editable layout.

## Delta Media

Media alpha.3 declares library, music, video, podcasts, audiobooks, radio, playlists, queue and listening statistics. All use the existing shared player, IndexedDB library and persistence. Its settings hide navigation tabs without deleting content. Settings cannot be hidden. The standalone workbench HTML contains a local-file player, not an embedded copy of the complete Media application; a real installed Media app is required in a connected host.
