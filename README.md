# Delta UI

One source for the Delta interface. Web, Linux/Windows Desktop and Android consume this package; screens, translations, widgets and client logic are not forked in hosts.

## Development

`npm ci && npm test && npm run test:i18n && npm run build`

The browser adapter preserves the existing Web service API, sessions, MCP and SSH controls. Native hosts use the versioned bridge and report their actual available features. A native package is not equivalent to the complete Web server capability set.


No owner token belongs in a UI asset, Plugin UI message, URL or settings export. Native root commands and untrusted plugin channels have separate authorization boundaries.
