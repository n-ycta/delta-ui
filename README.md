# Delta UI

One source for the Delta interface. Web, Linux/Windows Desktop and Android consume this package; screens, translations, widgets and client logic are not forked in hosts.

## Development

`npm ci && npm test && npm run test:i18n && npm run build`

The browser adapter preserves the existing Web service API, sessions, MCP and SSH controls. Native hosts use the versioned bridge and report their actual available features. A native package is not equivalent to the complete Web server capability set.

See the [canonical P0/P1 roadmap](https://github.com/n-ycta/delta/blob/main/docs/roadmap.md) and [architecture record](https://github.com/n-ycta/delta/blob/main/docs/architecture/ui-hosts.md). UI source-package pinning is implemented first; cryptographically signed independent UI activation/rollback is not yet a released capability. Never load arbitrary remote JavaScript as a trusted UI update.

No owner token belongs in a UI asset, Plugin UI message, URL or settings export. Native root commands and untrusted plugin channels have separate authorization boundaries.
