# Host auto-update from delta-ui

Each host repository (delta-web, delta-desktop, delta-android) runs `.github/workflows/ui-sync.yml`
every 30 minutes (and on `workflow_dispatch` / `repository_dispatch: delta-ui-updated`):

1. Resolve the newest `delta-ui` `main` commit whose **Verify shared UI** run succeeded.
2. If it differs from the pinned archive, run `scripts/host-ui-sync.mjs <sha>` from the currently pinned UI:
   re-pin `package.json`/lock, `Cargo.toml`/lock (`delta-native-host` rev), bump the patch version in
   every manifest and prepend release notes taken from the UI changelog.
3. Install and run the host's fast checks, commit, tag `vX.Y.Z`, push.
4. Dispatch the host's own build/release workflow on the new tag (pushes made with `GITHUB_TOKEN`
   do not trigger workflows by themselves). The normal release gates still apply.

Installed web hosts then update through the Delta updater; native desktop/Android builds are
published as new releases (there is no in-place native binary updater yet).
