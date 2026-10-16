# Delta UI

The shared React/TypeScript interface for [Delta Web](https://github.com/n-ycta/delta-web), [Delta Desktop](https://github.com/n-ycta/delta-desktop) and [Delta Android](https://github.com/n-ycta/delta-android). Screens, EN/RU translations, plugin settings, widgets and client-side contracts live here rather than being forked in each application.

## For users

This repository is a UI package, not a standalone server or an application installer. Install one of the hosts above. Web is for browsers and a reachable self-hosted node; Desktop and Android embed a Rust Core and render the same shared interface locally.

Hosts pin a specific immutable source commit and ship the resulting UI with their release. `ui-package.json` describes Host Bridge compatibility. Independent signed UI activation, hot replacement and rollback are **not enabled**; updating the host updates its bundled UI.

## Architecture

- **Web:** the HTTP adapter calls the Web capability facade using the actual browser user's signed session or scoped API token. The authentication gate mounts management screens only after the API confirms a principal.
- **Native:** bounded JSON IPC goes through `src/host` and the Rust adapter in `crates/native-host`. Owner credentials stay in Rust; unavailable native operations do not fall back to a privileged Web server.
- **Services:** MCP, updates, SSH provisioning and observability are independent optional plugins. Native service routing requires an explicit node; missing capabilities remain visibly unavailable.
- **Plugins:** settings, conditions, actions, tables, metrics and dashboards are described by validated manifests. Hosts do not hardcode a specific Leads or Type UI. Arbitrary plugin HTML frames are disabled.
- **Storage:** native documents persist through the host; Android uses Keystore-backed encryption. Web persistence remains the responsibility of its server and configured plugins.

The native bridge is reserved for the trusted root document. Untrusted plugin channels and owner commands are separate authorization boundaries. No owner token, seed phrase or private key belongs in UI assets, URLs, plugin messages or exported settings.

## Development

Node 24 is required. From this repository:

```sh
npm ci --ignore-scripts
npm test
npm run test:i18n
npm run build
```

The build checks TypeScript and bundles the UI; i18n checks enforce EN/RU key/interpolation parity. Native runtime integration additionally requires Rust and the corresponding Desktop/Android platform toolchain. See each host's README for packaging, signing, OS permissions and acceptance tests.

When changing a shared contract, update the corresponding tests and host source pins. Do not replace an unavailable backend with mock data in production. UI visibility is not authorization: Core must enforce every scope independently.
