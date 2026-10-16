# Host Bridge 1.0

The trusted root document communicates with the native host through `host_info` and `host_call`. Native hosts verify the main window and bundled origin. HTTP/HTTPS remote origins are not privileged bridge clients. Untrusted plugin frames do not receive the root bridge; initial native builds disable frames entirely.

`host_info` reports separate UI, shell, bridge and core versions, actual node mode (embedded or attached), lifecycle and features. A compiled binary is not proof of mobile background or physical-device support.

```json
{"capability":"core.info","args":{},"node":null}
```

For JavaScript callers, omit `node` for the local node; native requests accept an optional node target. Capability segments use `^[a-z][a-z0-9_-]{0,47}$`. JSON requests are limited to 64 KiB. Unknown Rust request fields, invalid arguments and oversized requests are rejected. Ordinary failures return stable structured errors. Do not put file data or owner credentials into this bridge.

The native owner credential remains in Rust. Local profile attachment validates node identity, and an exclusive profile lease prevents duplicate GUI runtimes. Capability scopes, node trust, UI authorization and OS permissions are separate boundaries. Process scopes are not an OS sandbox.

## Plugin SDK broker

The SDK source provides a source-window/origin-pinned message broker with a random channel nonce, exact capability allowlist, no cross-node routing, four concurrent calls and immediate revocation. It sanitizes internal errors and suppresses results after revocation. The broker must be integrated into an isolated view before use; its existence does not mean standalone/embedded apps or workspaces are implemented.

## UI package delivery

Version 0.1.0 is bundled from immutable source commits with package-lock integrity. Static release checksums detect corruption; they do not authenticate a publisher. Independent UI download/activation is disabled. Hosts must not load arbitrary remote JavaScript or treat an unsigned bundle as an authorized UI update.
