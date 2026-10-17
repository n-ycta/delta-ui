# Update and Media reliability review

This checklist tracks the complete user report. An implementation is not an installed update. Each row needs a regression test and release/registry evidence before closure. No user data may be reset to make a test pass.

| # | Acceptance requirement | Initial evidence / owning boundary | Status |
|---|---|---|---|
| 1 | Failed updates terminate every waiting item | Updater expects a flat version; Core returns installed[]; pending entries never terminalize | Updater 0.1.1 released; 17 deterministic tests cover Core installed[] result and terminal skipped states |
| 2 | Web restart preserves authenticated shell | Auth gate rejects cached principal on any info error | Implemented; actual WebAuthGate browser regression preserves mounted input/frame on transient failure; 401 still signs out |
| 3 | Reconnect notices are localized; no false core-down/login error | web.info not_found is not authentication failure | Implemented; RU reconnect regression and 2,186-key EN/RU parity pass; inventory errors no longer mark the connection down |
| 4 | Update click acknowledges immediately; active progress refreshes promptly | Mutation pending not used by install buttons | Implemented; click-pending browser assertion and one-second active-job polling |
| 5 | Collapsible compact node groups with update counts | Flat component list repeats node names | Implemented; actual Updates browser test verifies per-node groups, counts and collapsed current node |
| 6 | Progress is prominent and distinct | Ordinary panel follows long list | Implemented; mobile light/dark screenshots inspected; active accent panel placed before inventory |
| 7 | Optional bounded parallel updates | Serialize installer per node; local Web last; no unsafe same-node concurrency | Updater 0.1.1 released; 1–3 cross-node workers tested; same-node serialization and local Web-last preserved |
| 8 | Context-menu selection and batch library deletion | Per-item confirmation only | Media 0.3.6 released; real service + browser at 390/1440 verify right-click selection, batch deletion and reload |
| 9 | Skip delete confirmation for one hour | Must expire; never skip silently forever | Media 0.3.6 released; browser confirms one-hour opt-out and immediate subsequent delete |
| 10 | Deleted radio never reappears after sync/reload | Client/server deletion and identity protocol | Media 0.3.6 released; real service restart and source-identity deletion tests; published Core capability path passes |
| 11 | Deleted YouTube item never reappears after sync/reload | Same boundary, test independently | Media 0.3.6 released; YouTube source tombstone test and browser delete/sync/reload pass |
| 12 | Favorite and queue states remain independent and durable | Whole-state sync and cross-frame mutation races | Media 0.3.6 released; field patch/reconciliation and concurrent search/library action regressions pass |
| 13 | Explicit single-click Play on search and library rows | Search lacks play button/title action | Media 0.3.6 released; explicit Play button/title/cover; real local decoder regression passes |
| 14 | Play now does not mutate queue | play handler inserts current track | Media 0.3.6 released; currentId/playId independent of queue; saved-state regression passes |
| 15 | Stable progress without synthetic time or zero jumps | Player current reference detached by sync | Media 0.3.6 released; stable decoder references and provider-confirmed positions; real WAV seek/reload regression passes |
| 16 | Player displays available artwork | Footer always renders generic icon | Media 0.3.6 released; footer uses available artwork; unavailable artwork retains fallback |
| 17 | Discoverable video show/hide/restore, compact/resize | Preserve decoder when hidden; test actual provider separately | Media 0.3.6 released; real WebM decoder survives compact/resize/hide/restore. Cross-surface video reparenting and external YouTube playback not established |
| 18 | No false already-open-elsewhere warning | Slot placeholder unconditionally rendered | Implemented; repeated actual frame switches preserve one iframe and no false placeholder; browser regression passes |
| 19 | YouTube artist/channel page with paginated tracks | Provider support and real external verification needed | Implemented in headless provider and Media; real public channel metadata verified. Full uploads pagination uses a separate endpoint, with deterministic continuation test |
| 20 | YouTube playlist import | Provider support and real external verification needed | Implemented; real public playlist returns 13 items; deterministic pagination. Very large imports remain bounded by bridge payload/storage limits |
| 21 | Canvas move/resize snapping with guides and Alt bypass | Missing implementation; screen-pixel threshold at every zoom | Implemented; move/resize edge/center snapping, scale-aware threshold and Alt bypass; unit and actual drag/guide/persist tests pass |
| 22 | Studio browser address/search/navigation | Embedded websites can refuse framing; never claim bypass | Implemented; address/search/back/forward/reload and external-browser fallback tested. Embedded websites may refuse framing; not an unrestricted native browser |
| 23 | Remove redundant whole-Media desktop | Versioned, backed-up migration; preserve user customization | Implemented; backed-up versioned migration removes only exact redundant root whole-Media desktop, not custom compositions |
| 24 | Remove redundant whole-Console desktop | Same migration; remove template from creation UI | Implemented; same migration covers whole-Console; customized layout preservation unit tests pass |
| 25 | Media dashboard surfaces operate | Test multiple surfaces and one playback owner | Real Media SDK embedding at 390/1440 and independent surfaces/single-owner browser tests pass; physical native devices not tested |
| 26 | App widgets save regardless of valid size | UI emits system/app; server rejects this feed | Web server accepts system/app feed; round-trip schema regression and plugin widget save/reload browser tests pass |
| 27 | Itemized review and truthful delivery states | Record implementation, tests, push, release, registry, installed separately | This review tracks every reported requirement; delivery and unverified conditions remain separate |

## Delivery evidence

- Published: Media 0.3.6 (`2bcc02c`), updater 0.1.1 (`b4d15f3`); downloaded GitHub assets pass published SHA256SUMS. YouTube source follow-up adds full channel uploads pagination.
- Web broker/schema and updater dependency committed as `4d211c0`; all 65 server tests pass, including the updated skipped-after-failure contract.
- Shared UI 0.3.2 is the pending release in this change. Host repinning, host releases and registry publication must be verified after CI; this document does not claim they have happened already.
- Local checks: Media 23 TypeScript tests, 6 API tests, actual WAV/WebM playback, offline restart, shared surfaces, 390/1440 search/library actions; UI host/workbench/app/i18n/build, reliability, frame ownership, canvas interactions and populated-canvas performance tests. Catalog regression covers 320/360/390/1440, RU/EN, light/dark, centered icons and no horizontal overflow.
- Published Core 0.4.4 + published Media 0.3.6 were tested together in an isolated loopback profile: scoped process registration, real capability routing, independent field merge, tombstone deletion and denial of an unrelated capability to a scoped reader.
- Real external metadata checks: YouTube search returned 20 items; channel and playlist metadata returned actual records. This is not evidence of external audio playback or a successful yt-dlp download.

## Remaining verification boundaries

- No physical Android/desktop-device installation or user's production node was inspected. Published assets are not proof of installation.
- The real Core test uses HTTP capability transport, not an MCP client. End-to-end MCP transport is unverified in this incident.
- External provider playback/account/embed restrictions remain; no synthetic progress/audio is used as proof. Multi-frame video reparenting is not covered by the single-owner decoder tests.
- Library field patches prevent unrelated-field clobbering; they are not a general distributed conflict-free database. Arbitrarily large playlist/queue payloads are not guaranteed by bounded item batching.
