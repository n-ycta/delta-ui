# Themes, media and intents for portable apps

All three are **presentation/coordination only** — none of them is a grant, token or
host capability. They travel over the same channel opened by `connectPlugin()`.

```ts
import { connectPlugin, applyThemeTokens } from "@delta/ui/sdk/client";
const host = await connectPlugin(new URL(location.href).searchParams.get("parentOrigin")!);
applyThemeTokens(host.context.tokens);
host.onPresentation((c) => applyThemeTokens(c.tokens));
```

## One global theme

The user picks one skin for the whole system (All apps → Theme). Four skins ship:

| Skin | Scheme | Typeface | Character |
|---|---|---|---|
| `latte` (Catppuccin Latte) | light | Manrope | soft, rounded |
| `gruvbox` (Gruvbox Light) | light | Golos Text + Literata italic headings | warm, editorial |
| `mocha` (Catppuccin Mocha) | dark | Onest | soft, rounded |
| `tokyo` (Tokyo Night) | dark | JetBrains Mono everywhere | sharp, uppercase labels |

`context.tokens` carries colours, chart series, fonts, radii, border width, density and type
scale. `applyThemeTokens()` validates and maps them to CSS variables:
`--delta-bg`, `--delta-surface`, `--delta-ink`, `--delta-muted`, `--delta-accent`, `--delta-accent-ink`,
`--delta-rule`, … (camelCase palette keys become kebab-case), `--delta-series-0…`,
`--delta-font-sans|heading|mono`, `--delta-r-sm|md|lg`, `--delta-border`,
`--delta-heading-weight|case|tracking`; plus `data-theme`, `data-delta-skin`, `data-density`
on the root element. Frames are sandboxed on their own origin, so **bundle the fonts listed in
`tokens.fontKeys`** (Fontsource packages) — host fonts cannot be shared.

The launch URL also carries `theme=light|dark` and `skin=<id>` for a flash-free first paint.

## Media session (dock mini-player)

```ts
host.reportMedia({ playing: true, title: "Song", subtitle: "Artist", canNext: true, canPrev: true });
host.onMediaCommand((c) => c === "toggle" ? player.toggle() : c === "next" ? player.next() : …);
host.reportMedia(null); // idle
```

The host shows the most recent state in the dock and on desktops and sends
`toggle | play | pause | next | prev`. App frames live above the router, so leaving the app,
switching desktops or opening the Console never stops playback — only “Stop” in the
dock menu or uninstalling does.

## Intents between apps

A source app (YouTube, SoundCloud, Spotify search…) hands media to the player without
direct access to it:

```ts
const r = await host.sendIntent("media.play", { url, title, artist, artwork, kind: "audio", provider: "youtube" });
// "delivered" | "queued" (receiver started in the background) | "forbidden"
host.onIntent((intent, payload, from) => { … }); // receiver side
```

Policy comes from the reviewed `app-catalog.json`, never from the frame:

```json
"intents": { "send": ["media.play", "media.enqueue"], "receive": [] }
```

The sender must declare `send`, exactly one other catalog app must declare `receive`.
Payloads must be plain JSON ≤ 64 KB; a missing receiver is started and the intent is queued
(max 16).

Standard media intents (`dev.delta.media` receives them):

| Intent | Payload |
|---|---|
| `media.play` | `{ url, title, artist?, album?, artwork?, duration?, kind: "audio"|"video", provider?, embed? }` |
| `media.enqueue` | same as `media.play`, or `{ items: [...] }` (≤ 200) |

`embed` is an `https://` player URL from a known provider (YouTube, SoundCloud, Spotify) used
when the stream itself cannot be played directly.
