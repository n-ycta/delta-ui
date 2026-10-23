//! Decision logic for in-app Android updates. No I/O: the host downloads and installs, this crate only
//! decides what is newer, which asset to take, whether a URL is trusted and whether bytes match.
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::time::{Duration, Instant};

pub const APK: &str = "Delta-Android-arm64-x86_64.apk";
pub const SUMS: &str = "SHA256SUMS";
const RELEASE_PREFIX: &str = "https://github.com/n-ycta/delta-android/releases/download/";
const CDN_HOSTS: [&str; 2] = ["objects.githubusercontent.com", "release-assets.githubusercontent.com"];
pub const MAX_APK_BYTES: u64 = 200 * 1024 * 1024;
pub const MAX_SUMS_BYTES: usize = 4096;
pub const MAX_REDIRECTS: usize = 3;
/// How long `Installing` blocks other work: the system dialog may be cancelled without any callback to us.
pub const INSTALL_PHASE_TTL: Duration = Duration::from_secs(120);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Ver {
    major: u64,
    minor: u64,
    patch: u64,
    pre: Option<String>,
}

/// `1.2.3`, `v1.2.3`, `1.2.3-rc.1`. Anything else (build metadata, missing parts, non-digits) is refused.
pub fn parse_version(s: &str) -> Option<Ver> {
    let s = s.strip_prefix('v').unwrap_or(s);
    let (core, pre) = match s.split_once('-') {
        Some((c, p)) if !p.is_empty() && p.len() <= 32 && p.chars().all(|c| c.is_ascii_alphanumeric() || c == '.') => (c, Some(p.to_string())),
        Some(_) => return None,
        None => (s, None),
    };
    let mut it = core.split('.');
    let mut num = || it.next().filter(|p| !p.is_empty() && p.len() <= 9 && p.bytes().all(|b| b.is_ascii_digit())).and_then(|p| p.parse::<u64>().ok());
    let (major, minor, patch) = (num()?, num()?, num()?);
    if it.next().is_some() {
        return None;
    }
    Some(Ver { major, minor, patch, pre })
}

fn pre_cmp(a: &str, b: &str) -> std::cmp::Ordering {
    let (mut x, mut y) = (a.split('.'), b.split('.'));
    loop {
        match (x.next(), y.next()) {
            (None, None) => return std::cmp::Ordering::Equal,
            (None, Some(_)) => return std::cmp::Ordering::Less,
            (Some(_), None) => return std::cmp::Ordering::Greater,
            (Some(p), Some(q)) => {
                let ord = match (p.parse::<u64>(), q.parse::<u64>()) {
                    (Ok(m), Ok(n)) => m.cmp(&n),
                    (Ok(_), Err(_)) => std::cmp::Ordering::Less,
                    (Err(_), Ok(_)) => std::cmp::Ordering::Greater,
                    (Err(_), Err(_)) => p.cmp(q),
                };
                if ord != std::cmp::Ordering::Equal {
                    return ord;
                }
            }
        }
    }
}

impl Ver {
    fn cmp(&self, o: &Ver) -> std::cmp::Ordering {
        (self.major, self.minor, self.patch).cmp(&(o.major, o.minor, o.patch)).then_with(|| match (&self.pre, &o.pre) {
            (None, None) => std::cmp::Ordering::Equal,
            (Some(_), None) => std::cmp::Ordering::Less, // 1.0.0-rc.1 < 1.0.0
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (Some(a), Some(b)) => pre_cmp(a, b),
        })
    }
}

/// "Update available" policy: strictly newer by semver, pre-releases included (`1.0.0-rc.1 < 1.0.0`, so an rc
/// user is offered the final). Equal or older is never an update; unparsable input is never newer.
/// The app does not compare Android `versionCode` to decide availability; the downgrade ban by `versionCode`
/// is enforced by Android itself, and the Kotlin installer refuses only a `versionCode` LOWER than the current one.
pub fn newer(current: &str, candidate: &str) -> bool {
    match (parse_version(current), parse_version(candidate)) {
        (Some(c), Some(n)) => n.cmp(&c) == std::cmp::Ordering::Greater,
        _ => false,
    }
}

/// Version strings accepted from the WebView before a download URL is built from them.
pub fn valid_version(v: &str) -> bool {
    !v.starts_with('v') && parse_version(v).is_some()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Channel {
    Stable,
    Pre,
}

impl Channel {
    pub fn parse(s: &str) -> Option<Channel> {
        match s {
            "stable" => Some(Channel::Stable),
            "pre" => Some(Channel::Pre),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Offer {
    pub version: String,
    pub size: u64,
    pub asset: String,
}

/// Picks the APK for this device: an exact-ABI build if the release has one, else the universal APK.
/// `abis` is `Build.SUPPORTED_ABIS` in preference order.
pub fn choose_asset<'a>(names: &[&'a str], abis: &[&str]) -> Option<&'a str> {
    for abi in abis {
        let exact = format!("Delta-Android-{abi}.apk");
        if let Some(n) = names.iter().find(|n| **n == exact) {
            return Some(n);
        }
    }
    names.iter().find(|n| **n == APK).copied()
}

/// Best release by `newer` (semver, see there) from the GitHub API answer (one release object or an array of them).
/// Tags must be `v<semver>`. Drafts are ignored; pre-releases only on the `Pre` channel; a release needs the APK and `SHA256SUMS`.
pub fn pick(releases: &Value, channel: Channel, current: &str, abis: &[&str]) -> Option<Offer> {
    let list: Vec<&Value> = match releases {
        Value::Array(a) => a.iter().collect(),
        v @ Value::Object(_) => vec![v],
        _ => return None,
    };
    let mut best: Option<(Ver, Offer)> = None;
    for r in list {
        if r["draft"].as_bool() == Some(true) || (channel == Channel::Stable && r["prerelease"].as_bool() == Some(true)) {
            continue;
        }
        let Some(tag) = r["tag_name"].as_str() else { continue };
        // the download URL is built as `.../download/v<version>/`, so a tag without the `v` would 404
        let Some(bare) = tag.strip_prefix('v') else { continue };
        let Some(ver) = parse_version(bare).filter(|_| valid_version(bare)) else { continue };
        if !newer(current, bare) {
            continue;
        }
        let assets = r["assets"].as_array().cloned().unwrap_or_default();
        let names: Vec<&str> = assets.iter().filter_map(|a| a["name"].as_str()).collect();
        if !names.contains(&SUMS) {
            continue;
        }
        let Some(asset) = choose_asset(&names, abis) else { continue };
        let size = assets.iter().find(|a| a["name"] == asset).and_then(|a| a["size"].as_u64()).unwrap_or(0);
        let offer = Offer { version: bare.to_string(), size, asset: asset.to_string() };
        if best.as_ref().map(|(b, _)| ver.cmp(b) == std::cmp::Ordering::Greater).unwrap_or(true) {
            best = Some((ver, offer));
        }
    }
    best.map(|(_, o)| o)
}

/// Download URL built by the host itself; the WebView only supplies a validated version.
pub fn asset_url(version: &str, name: &str) -> Option<String> {
    (valid_version(version) && (name == SUMS || name == APK || (name.starts_with("Delta-Android-") && name.ends_with(".apk") && name.bytes().all(|b| b.is_ascii_alphanumeric() || b"-_.".contains(&b)))))
        .then(|| format!("{RELEASE_PREFIX}v{version}/{name}"))
}

/// Redirect policy: hop 0 must be the official release path; later hops only GitHub's asset CDN. HTTPS only,
/// no credentials or ports, at most `MAX_REDIRECTS` redirects.
pub fn allowed_url(url: &str, hop: usize) -> bool {
    if hop > MAX_REDIRECTS {
        return false;
    }
    if hop == 0 {
        return url.starts_with(RELEASE_PREFIX) && !url.contains("..") && !url.contains('@');
    }
    let Some(rest) = url.strip_prefix("https://") else { return false };
    let end = rest.find(['/', '?', '#']).unwrap_or(rest.len());
    let authority = &rest[..end];
    !authority.contains('@') && !authority.contains(':') && CDN_HOSTS.contains(&authority)
}

/// Checksum of `name` from `sha256sum` output (`<64 hex>  <name>` or `<hex> *<name>`).
pub fn sum_for(text: &str, name: &str) -> Option<[u8; 32]> {
    for line in text.lines() {
        let Some((hex, file)) = line.split_once(char::is_whitespace) else { continue };
        if file.trim_start().trim_start_matches('*') != name || hex.len() != 64 {
            continue;
        }
        let mut out = [0u8; 32];
        for (i, b) in out.iter_mut().enumerate() {
            *b = u8::from_str_radix(hex.get(i * 2..i * 2 + 2)?, 16).ok()?;
        }
        return Some(out);
    }
    None
}

/// Lower-case hex of a digest (what the Kotlin installer compares against).
pub fn hex(d: &[u8; 32]) -> String {
    d.iter().map(|b| format!("{b:02x}")).collect()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Phase {
    #[default]
    Idle,
    Downloading,
    Ready,
    Installing,
    Failed,
}

impl Phase {
    pub fn as_str(self) -> &'static str {
        match self {
            Phase::Idle => "idle",
            Phase::Downloading => "downloading",
            Phase::Ready => "ready",
            Phase::Installing => "installing",
            Phase::Failed => "failed",
        }
    }
}

/// Progress of the single update the host handles at a time. Pure: the host wraps it in a mutex.
/// Every download gets a new `generation`; a task may write only while its own generation is current.
#[derive(Debug, Clone, Default)]
pub struct UpdateState {
    pub phase: Phase,
    pub received: u64,
    pub total: u64,
    pub version: String,
    pub error: String,
    /// SHA-256 of the verified APK, set when the download finishes.
    pub sum: [u8; 32],
    generation: u64,
    installing_since: Option<Instant>,
}

impl UpdateState {
    /// Lets an expired `Installing` fall back to `Ready` (digest and version are still in the state).
    fn tick(&mut self, now: Instant) {
        if self.phase == Phase::Installing && self.installing_since.is_none_or(|t| now.saturating_duration_since(t) >= INSTALL_PHASE_TTL) {
            self.phase = Phase::Ready;
        }
    }
    /// Current phase, with an expired install shown as `Ready`.
    pub fn status(&mut self, now: Instant) -> Phase {
        self.tick(now);
        self.phase
    }
    /// Starts a download and returns its generation; busy while downloading or installing.
    pub fn begin_download(&mut self, version: &str, total: u64, now: Instant) -> Result<u64, &'static str> {
        self.tick(now);
        if matches!(self.phase, Phase::Downloading | Phase::Installing) {
            return Err("update_busy");
        }
        let generation = self.generation + 1;
        *self = UpdateState { phase: Phase::Downloading, total, version: version.to_string(), generation, ..Default::default() };
        Ok(generation)
    }
    /// Progress from the task of `generation`; false if that task is stale.
    pub fn progress(&mut self, generation: u64, received: u64) -> bool {
        let live = self.generation == generation && self.phase == Phase::Downloading;
        if live {
            self.received = received;
        }
        live
    }
    /// Result of the task of `generation` (the verified digest or an error code); false if it is stale.
    pub fn finish(&mut self, generation: u64, result: Result<[u8; 32], String>) -> bool {
        if self.generation != generation || self.phase != Phase::Downloading {
            return false;
        }
        match result {
            Ok(sum) => (self.phase, self.sum) = (Phase::Ready, sum),
            Err(e) => (self.phase, self.error) = (Phase::Failed, e),
        }
        true
    }
    /// A cache clean-up or reset must not touch an active download or install.
    pub fn check_cleanup_allowed(&mut self, now: Instant) -> bool {
        self.tick(now);
        !matches!(self.phase, Phase::Downloading | Phase::Installing)
    }
    /// Back to idle (caller checked `check_cleanup_allowed` under the same lock). Generation keeps counting.
    pub fn reset(&mut self) {
        *self = UpdateState { generation: self.generation + 1, ..Default::default() };
    }
    /// Moves a ready update of `version` to installing and returns the digest it must still have.
    pub fn begin_install(&mut self, version: &str, now: Instant) -> Result<[u8; 32], &'static str> {
        self.tick(now);
        match self.phase {
            Phase::Installing => Err("update_busy"),
            Phase::Ready if self.version == version => {
                (self.phase, self.installing_since) = (Phase::Installing, Some(now));
                Ok(self.sum)
            }
            _ => Err("update_not_ready"),
        }
    }
    /// After the installer answered: an error returns to `Ready`, success stays `Installing`.
    pub fn end_install(&mut self, ok: bool) {
        if self.phase == Phase::Installing && !ok {
            self.phase = Phase::Ready;
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum VerifyError {
    SizeLimit,
    ChecksumMismatch,
}

/// Plain streaming SHA-256 (no size cap) for re-checking a file already on disk.
pub struct Hasher(Sha256);

impl Hasher {
    pub fn new() -> Self {
        Self(Sha256::new())
    }
    pub fn update(&mut self, chunk: &[u8]) {
        self.0.update(chunk);
    }
    pub fn finish(self) -> [u8; 32] {
        self.0.finalize().into()
    }
}

impl Default for Hasher {
    fn default() -> Self {
        Self::new()
    }
}

/// Streaming hash with a hard size cap: feed chunks as they arrive, then `finish`.
pub struct Verifier {
    hasher: Sha256,
    received: u64,
    limit: u64,
}

impl Verifier {
    pub fn new(limit: u64) -> Self {
        Self { hasher: Sha256::new(), received: 0, limit }
    }
    pub fn update(&mut self, chunk: &[u8]) -> Result<(), VerifyError> {
        self.received = self.received.saturating_add(chunk.len() as u64);
        if self.received > self.limit {
            return Err(VerifyError::SizeLimit);
        }
        self.hasher.update(chunk);
        Ok(())
    }
    pub fn received(&self) -> u64 {
        self.received
    }
    /// The digest of everything fed so far, if it equals `expected`.
    pub fn finish(self, expected: &[u8; 32]) -> Result<[u8; 32], VerifyError> {
        let digest: [u8; 32] = self.hasher.finalize().into();
        if &digest == expected {
            Ok(digest)
        } else {
            Err(VerifyError::ChecksumMismatch)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn versions_parse_and_order_like_semver() {
        assert!(parse_version("1.2.3").is_some() && parse_version("v1.2.3").is_some());
        for bad in ["", "1", "1.2", "1.2.3.4", "1.2.x", "1.2.3+build", "1.2.3-", "-1.2.3", "1..3", "9999999999.0.0"] {
            assert!(parse_version(bad).is_none(), "{bad}");
        }
        assert!(newer("0.1.15", "0.1.16") && newer("0.1.9", "0.1.10") && newer("0.9.0", "1.0.0"));
        assert!(!newer("0.1.15", "0.1.15"), "equal is not an update");
        assert!(!newer("0.1.15", "0.1.14"), "downgrade is not an update");
        assert!(newer("1.0.0-rc.1", "1.0.0") && !newer("1.0.0", "1.0.0-rc.1"));
        assert!(newer("1.0.0-rc.1", "1.0.0-rc.2") && newer("1.0.0-rc.2", "1.0.0-rc.10") && newer("1.0.0-alpha", "1.0.0-beta"));
        assert!(!newer("0.1.15", "garbage") && !newer("garbage", "9.9.9"));
        assert!(valid_version("0.1.16") && !valid_version("v0.1.16") && !valid_version("../x"));
    }

    fn release(tag: &str, pre: bool, draft: bool, assets: &[&str]) -> Value {
        json!({"tag_name": tag, "prerelease": pre, "draft": draft, "assets": assets.iter().map(|n| json!({"name": n, "size": 1234})).collect::<Vec<_>>()})
    }

    #[test]
    fn asset_choice_prefers_the_device_abi_then_the_universal_apk() {
        let names = ["SHA256SUMS", APK, "Delta-Android-arm64-v8a.apk"];
        assert_eq!(choose_asset(&names, &["arm64-v8a", "armeabi-v7a"]), Some("Delta-Android-arm64-v8a.apk"));
        assert_eq!(choose_asset(&names, &["x86_64"]), Some(APK));
        assert_eq!(choose_asset(&["SHA256SUMS"], &["arm64-v8a"]), None);
        assert_eq!(choose_asset(&["Delta-Android-evil.apk.exe"], &["x86_64"]), None);
    }

    #[test]
    fn release_choice_respects_channel_drafts_assets_and_version() {
        let ok = [APK, SUMS];
        let all = json!([
            release("v0.2.0-rc.1", true, false, &ok),
            release("v0.1.16", false, false, &ok),
            release("v0.3.0", false, true, &ok),
            release("v0.1.17", false, false, &[APK]),
            release("v0.1.15", false, false, &ok),
            release("nightly", false, false, &ok),
            release("0.9.9", false, false, &ok), // no `v`: the download URL would 404
        ]);
        let stable = pick(&all, Channel::Stable, "0.1.15", &[]).unwrap();
        assert_eq!((stable.version.as_str(), stable.asset.as_str(), stable.size), ("0.1.16", APK, 1234));
        assert_eq!(pick(&all, Channel::Pre, "0.1.15", &[]).unwrap().version, "0.2.0-rc.1");
        assert_eq!(pick(&all, Channel::Stable, "0.1.16", &[]), None, "nothing newer, drafts and unsigned releases ignored");
        // the /releases/latest answer is a single object
        assert_eq!(pick(&release("v0.1.16", false, false, &ok), Channel::Stable, "0.1.15", &[]).unwrap().version, "0.1.16");
        // an rc user is offered the final release of the same version
        assert_eq!(pick(&release("v1.0.0", false, false, &ok), Channel::Stable, "1.0.0-rc.1", &[]).unwrap().version, "1.0.0");
        assert_eq!(pick(&json!("nope"), Channel::Stable, "0.1.15", &[]), None);
    }

    #[test]
    fn urls_are_built_by_the_host_and_redirects_stay_on_github() {
        assert_eq!(asset_url("0.1.16", SUMS).unwrap(), "https://github.com/n-ycta/delta-android/releases/download/v0.1.16/SHA256SUMS");
        assert!(asset_url("0.1.16/../../x", APK).is_none() && asset_url("0.1.16", "../evil").is_none() && asset_url("v0.1.16", APK).is_none());
        assert!(allowed_url(&asset_url("0.1.16", APK).unwrap(), 0));
        assert!(!allowed_url("https://github.com/evil/delta-android/releases/download/v1.0.0/x", 0));
        assert!(!allowed_url("http://github.com/n-ycta/delta-android/releases/download/v1.0.0/x", 0));
        assert!(allowed_url("https://objects.githubusercontent.com/github-production-release-asset/1?x=1", 1));
        assert!(allowed_url("https://release-assets.githubusercontent.com/a/b", 2));
        for bad in ["https://objects.githubusercontent.com.evil.com/a", "https://user@objects.githubusercontent.com/a", "https://objects.githubusercontent.com:8443/a", "http://objects.githubusercontent.com/a", "https://evil.com/objects.githubusercontent.com"] {
            assert!(!allowed_url(bad, 1), "{bad}");
        }
        assert!(!allowed_url("https://objects.githubusercontent.com/a", MAX_REDIRECTS + 1));
    }

    #[test]
    fn checksums_are_read_from_sha256sum_output() {
        let h = "aa".repeat(32);
        let text = format!("{h}  {APK}\n{}  other.apk\n", "bb".repeat(32));
        assert_eq!(sum_for(&text, APK), Some([0xaa; 32]));
        assert_eq!(sum_for(&format!("{h} *{APK}\n"), APK), Some([0xaa; 32]), "binary-mode marker");
        assert_eq!(sum_for(&text, "missing.apk"), None);
        assert_eq!(sum_for("zz  Delta-Android-arm64-x86_64.apk", APK), None);
        assert_eq!(sum_for(&format!("{}  {APK}", "ab".repeat(31)), APK), None, "short hash");
        assert_eq!(sum_for(&format!("{}  {APK}", "gg".repeat(32)), APK), None, "non-hex");
    }

    #[test]
    fn stale_downloads_cannot_overwrite_a_newer_one() {
        let (mut s, t) = (UpdateState::default(), Instant::now());
        let g1 = s.begin_download("0.1.16", 10, t).unwrap();
        assert_eq!(s.begin_download("0.1.17", 10, t), Err("update_busy"), "one download at a time");
        assert!(s.finish(g1, Err("network_failed".into())) && s.phase == Phase::Failed);
        let g2 = s.begin_download("0.1.17", 20, t).unwrap();
        assert!(g2 > g1);
        assert!(!s.progress(g1, 5) && !s.finish(g1, Ok([1; 32])), "old generation is ignored");
        assert_eq!((s.phase, s.received, s.version.as_str()), (Phase::Downloading, 0, "0.1.17"));
        assert!(s.progress(g2, 7) && s.finish(g2, Ok([2; 32])) && s.phase == Phase::Ready && s.sum == [2; 32]);
        assert!(!s.finish(g2, Err("late".into())) && s.phase == Phase::Ready, "a task reports once");
    }

    #[test]
    fn check_cleanup_never_resets_active_work() {
        let (mut s, t) = (UpdateState::default(), Instant::now());
        assert!(s.check_cleanup_allowed(t));
        let g = s.begin_download("0.1.16", 1, t).unwrap();
        assert!(!s.check_cleanup_allowed(t), "downloading");
        s.finish(g, Ok([3; 32]));
        assert!(s.check_cleanup_allowed(t));
        s.begin_install("0.1.16", t).unwrap();
        assert!(!s.check_cleanup_allowed(t), "installing");
        s.end_install(false);
        s.reset();
        assert_eq!(s.phase, Phase::Idle);
        assert!(!s.finish(g, Ok([9; 32])), "reset invalidates tasks of earlier generations");
    }

    #[test]
    fn install_is_single_shot_and_returns_to_ready_on_error() {
        let (mut s, t) = (UpdateState::default(), Instant::now());
        assert_eq!(s.begin_install("0.1.16", t), Err("update_not_ready"));
        let g = s.begin_download("0.1.16", 1, t).unwrap();
        assert_eq!(s.begin_install("0.1.16", t), Err("update_not_ready"), "still downloading");
        s.finish(g, Ok([4; 32]));
        assert_eq!(s.begin_install("0.1.99", t), Err("update_not_ready"), "other version");
        assert_eq!(s.begin_install("0.1.16", t), Ok([4; 32]));
        assert_eq!(s.begin_install("0.1.16", t), Err("update_busy"), "double tap");
        assert_eq!(s.begin_download("0.1.17", 1, t), Err("update_busy"));
        s.end_install(false);
        assert_eq!(s.phase, Phase::Ready);
        s.begin_install("0.1.16", t).unwrap();
        s.end_install(true);
        assert_eq!(s.phase, Phase::Installing);
        assert_eq!(hex(&[0xab; 32]), "ab".repeat(32));
    }

    #[test]
    fn checksum_lines_edge_cases() {
        let (a, b) = ("aa".repeat(32), "bb".repeat(32));
        assert_eq!(sum_for(&format!("{a}  {APK}\r\n{b}  other\r\n"), APK), Some([0xaa; 32]), "CRLF");
        assert_eq!(sum_for(&format!("{a}  {APK}\r\n{b}  other\r\n"), "other"), Some([0xbb; 32]));
        assert_eq!(sum_for(&format!("{a}  {APK}\n{b}  {APK}\n"), APK), Some([0xaa; 32]), "first line wins");
        assert_eq!(sum_for(&format!("{a}  ./{APK}\n"), APK), None, "`./name` is refused");
        assert_eq!(sum_for(&format!("{a}\t{APK}\n"), APK), Some([0xaa; 32]), "tab separator");
        assert_eq!(sum_for(&format!("{a}  {APK}.sig\n"), APK), None, "no prefix match");
    }

    #[test]
    fn release_choice_edge_cases() {
        let ok = [APK, SUMS];
        assert_eq!(pick(&release("0.2.0", false, false, &ok), Channel::Stable, "0.1.0", &[]), None, "tag without `v` would 404");
        assert_eq!(pick(&release("vv0.2.0", false, false, &ok), Channel::Stable, "0.1.0", &[]), None);
        let no_size = json!({"tag_name": "v0.2.0", "assets": [{"name": APK}, {"name": SUMS}]});
        assert_eq!(pick(&no_size, Channel::Stable, "0.1.0", &[]).unwrap().size, 0, "missing size means unknown");
        let many = json!([release("v1.0.0-rc.2", true, false, &ok), release("v1.0.0-rc.10", true, false, &ok), release("v1.0.0-rc.1", true, false, &ok)]);
        assert_eq!(pick(&many, Channel::Pre, "0.9.0", &[]).unwrap().version, "1.0.0-rc.10", "best of several pre-releases");
        let abi = release("v0.2.0", false, false, &[APK, SUMS, "Delta-Android-arm64-v8a.apk"]);
        assert_eq!(pick(&abi, Channel::Stable, "0.1.0", &["arm64-v8a"]).unwrap().asset, "Delta-Android-arm64-v8a.apk");
        assert_eq!(pick(&abi, Channel::Stable, "0.1.0", &["x86"]).unwrap().asset, APK);
    }

    #[test]
    fn installing_expires_after_the_ttl() {
        let (mut s, t) = (UpdateState::default(), Instant::now());
        let g = s.begin_download("0.1.16", 1, t).unwrap();
        s.finish(g, Ok([6; 32]));
        s.begin_install("0.1.16", t).unwrap();
        let almost = t + INSTALL_PHASE_TTL - Duration::from_secs(1);
        assert_eq!(s.status(almost), Phase::Installing);
        assert_eq!(s.begin_install("0.1.16", almost), Err("update_busy"));
        assert_eq!(s.begin_download("0.1.17", 1, almost), Err("update_busy"));
        assert!(!s.check_cleanup_allowed(almost));
        let late = t + INSTALL_PHASE_TTL;
        assert!(s.check_cleanup_allowed(late), "expired: clean-up allowed");
        assert_eq!(s.status(late), Phase::Ready);
        assert_eq!(s.begin_install("0.1.16", late), Ok([6; 32]), "install may be retried");
        assert_eq!(s.status(late + Duration::from_secs(1)), Phase::Installing, "the TTL restarts");
        let mut s2 = s.clone();
        assert!(s2.begin_download("0.1.17", 1, late + INSTALL_PHASE_TTL).is_ok(), "download allowed once expired");
    }

    #[test]
    fn verifier_checks_hash_and_caps_size() {
        let data = b"hello apk";
        let expected: [u8; 32] = Sha256::digest(data).into();
        let mut v = Verifier::new(100);
        v.update(&data[..4]).unwrap();
        v.update(&data[4..]).unwrap();
        assert_eq!(v.received(), 9);
        assert_eq!(v.finish(&expected), Ok(expected));
        let mut v = Verifier::new(100);
        v.update(data).unwrap();
        assert_eq!(v.finish(&[0u8; 32]), Err(VerifyError::ChecksumMismatch));
        let mut v = Verifier::new(5);
        assert_eq!(v.update(data), Err(VerifyError::SizeLimit));
    }
}

/// Network side, kept separate so the decisions above stay I/O-free. The only trusted entry points are
/// `fetch_offer` (GitHub API, no credentials) and `download_release` (official release URLs built here).
#[cfg(feature = "net")]
pub mod net {
    use super::*;
    use std::{io::Write, path::{Path, PathBuf}, time::Duration};

    const API: &str = "https://api.github.com/repos/n-ycta/delta-android/releases";

    /// `allowed_url` on the parsed, normalised URL (what reqwest actually connects to): lower-cased host, no
    /// default port, no credentials. A trailing-dot host (`example.com.`) is not in the allow-list and is refused.
    pub fn allowed_reqwest_url(u: &reqwest::Url, hop: usize) -> bool {
        u.scheme() == "https" && u.port().is_none() && u.username().is_empty() && u.password().is_none() && u.host_str().is_some() && {
            if hop == 0 {
                allowed_url(u.as_str(), 0)
            } else {
                hop <= MAX_REDIRECTS && CDN_HOSTS.contains(&u.host_str().unwrap_or(""))
            }
        }
    }

    pub fn client() -> Result<reqwest::Client, String> {
        reqwest::Client::builder()
            .user_agent("delta-android-updater")
            .connect_timeout(Duration::from_secs(20))
            .read_timeout(Duration::from_secs(60))
            .https_only(true)
            .redirect(reqwest::redirect::Policy::custom(|attempt| {
                if allowed_reqwest_url(attempt.url(), attempt.previous().len()) {
                    attempt.follow()
                } else {
                    attempt.error("untrusted_redirect")
                }
            }))
            .build()
            .map_err(|_| "client_failed".to_string())
    }

    /// Newest release above `current` for the channel, or `None`. Anonymous API: at most 60 requests an hour.
    pub async fn fetch_offer(c: &reqwest::Client, channel: Channel, current: &str, abis: &[&str]) -> Result<Option<Offer>, String> {
        let url = if channel == Channel::Stable { format!("{API}/latest") } else { format!("{API}?per_page=10") };
        let resp = c.get(url).header("Accept", "application/vnd.github+json").send().await.map_err(|_| "network_failed".to_string())?;
        if !resp.status().is_success() {
            return Err(format!("github_http_{}", resp.status().as_u16()));
        }
        if resp.content_length().unwrap_or(0) > 2_000_000 {
            return Err("response_too_large".into());
        }
        let body = resp.bytes().await.map_err(|_| "network_failed".to_string())?;
        if body.len() > 2_000_000 {
            return Err("response_too_large".into());
        }
        let json: Value = serde_json::from_slice(&body).map_err(|_| "bad_release_json".to_string())?;
        Ok(pick(&json, channel, current, abis))
    }

    /// Streams `url` into `dest`, hashing as it goes. The file only appears under `dest` after the checksum matched.
    pub async fn download_to(c: &reqwest::Client, url: &str, limit: u64, expected: &[u8; 32], dest: &Path, mut progress: impl FnMut(u64)) -> Result<[u8; 32], String> {
        let mut resp = c.get(url).send().await.map_err(|e| if e.is_redirect() { "untrusted_redirect".to_string() } else { "network_failed".to_string() })?;
        if !resp.status().is_success() {
            return Err(format!("download_http_{}", resp.status().as_u16()));
        }
        if resp.content_length().unwrap_or(0) > limit {
            return Err("size_limit".into());
        }
        let part = dest.with_extension("part");
        let mut file = std::fs::File::create(&part).map_err(|_| "storage_failed".to_string())?;
        let mut verifier = Verifier::new(limit);
        let result: Result<(), String> = async {
            while let Some(chunk) = resp.chunk().await.map_err(|_| "network_failed".to_string())? {
                verifier.update(&chunk).map_err(|_| "size_limit".to_string())?;
                file.write_all(&chunk).map_err(|_| "storage_failed".to_string())?;
                progress(verifier.received());
            }
            Ok(())
        }
        .await;
        let result = result.and_then(|_| verifier.finish(expected).map_err(|_| "checksum_mismatch".to_string())).and_then(|d| file.sync_all().map(|_| d).map_err(|_| "storage_failed".to_string()));
        match result {
            Ok(digest) => std::fs::rename(&part, dest).map(|_| digest).map_err(|_| "storage_failed".to_string()),
            Err(e) => {
                let _ = std::fs::remove_file(&part);
                Err(e)
            }
        }
    }

    /// Downloads `SHA256SUMS` and the APK of an official release into `dir/delta.apk` (verified); returns the path and its SHA-256.
    pub async fn download_release(c: &reqwest::Client, version: &str, asset: &str, size_hint: u64, dir: &Path, progress: impl FnMut(u64)) -> Result<(PathBuf, [u8; 32]), String> {
        asset_url(version, SUMS).ok_or("invalid_version")?;
        asset_url(version, asset).ok_or("invalid_version")?;
        download_release_from(c, |name| asset_url(version, name).unwrap_or_default(), asset, size_hint, dir, progress).await
    }

    /// `download_release` with the URL of each file (`SHA256SUMS`, the asset) supplied by `url_for`; tests point it at loopback.
    async fn download_release_from(c: &reqwest::Client, url_for: impl Fn(&str) -> String, asset: &str, size_hint: u64, dir: &Path, progress: impl FnMut(u64)) -> Result<(PathBuf, [u8; 32]), String> {
        let (sums_url, apk_url) = (url_for(SUMS), url_for(asset));
        std::fs::create_dir_all(dir).map_err(|_| "storage_failed".to_string())?;
        let mut resp = c.get(&sums_url).send().await.map_err(|_| "network_failed".to_string())?;
        if !resp.status().is_success() {
            return Err(format!("download_http_{}", resp.status().as_u16()));
        }
        let mut text = Vec::new();
        while let Some(chunk) = resp.chunk().await.map_err(|_| "network_failed".to_string())? {
            if text.len() + chunk.len() > MAX_SUMS_BYTES {
                return Err("size_limit".into());
            }
            text.extend_from_slice(&chunk);
        }
        let expected = sum_for(&String::from_utf8_lossy(&text), asset).ok_or("checksum_missing")?;
        let limit = if size_hint > 0 { size_hint.min(MAX_APK_BYTES) } else { MAX_APK_BYTES };
        let dest = dir.join("delta.apk");
        let digest = download_to(c, &apk_url, limit, &expected, &dest, progress).await?;
        Ok((dest, digest))
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use tokio::{io::{AsyncReadExt, AsyncWriteExt}, net::TcpListener};

        /// One-shot loopback HTTP server answering every request with `body`.
        async fn serve(body: Vec<u8>) -> String {
            let l = TcpListener::bind("127.0.0.1:0").await.unwrap();
            let addr = l.local_addr().unwrap();
            tokio::spawn(async move {
                loop {
                    let (mut s, _) = l.accept().await.unwrap();
                    let body = body.clone();
                    tokio::spawn(async move {
                        let mut buf = [0u8; 1024];
                        let _ = s.read(&mut buf).await;
                        let head = format!("HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", body.len());
                        let _ = s.write_all(head.as_bytes()).await;
                        let _ = s.write_all(&body).await;
                    });
                }
            });
            format!("http://{addr}/apk")
        }

        fn tmp() -> PathBuf {
            let d = std::env::temp_dir().join(format!("delta-update-test-{}-{:?}", std::process::id(), std::thread::current().id()));
            let _ = std::fs::remove_dir_all(&d);
            std::fs::create_dir_all(&d).unwrap();
            d
        }

        enum Resp {
            Ok(Vec<u8>),
            Status(u16),
            /// Declares `Content-Length: declared`, sends `body` and closes.
            Cut { declared: usize, body: Vec<u8> },
        }

        /// Loopback server: request path -> response; returns the base URL (`http://127.0.0.1:port`).
        async fn serve_routes(routes: Vec<(&'static str, Resp)>) -> String {
            let l = TcpListener::bind("127.0.0.1:0").await.unwrap();
            let addr = l.local_addr().unwrap();
            let routes = std::sync::Arc::new(routes);
            tokio::spawn(async move {
                loop {
                    let (mut s, _) = l.accept().await.unwrap();
                    let routes = routes.clone();
                    tokio::spawn(async move {
                        let mut buf = [0u8; 2048];
                        let n = s.read(&mut buf).await.unwrap_or(0);
                        let req = String::from_utf8_lossy(&buf[..n]).to_string();
                        let path = req.split_whitespace().nth(1).unwrap_or("").to_string();
                        let (head, body) = match routes.iter().find(|(p, _)| *p == path).map(|(_, r)| r) {
                            Some(Resp::Ok(b)) => (format!("HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", b.len()), b.clone()),
                            Some(Resp::Cut { declared, body }) => (format!("HTTP/1.1 200 OK\r\nContent-Length: {declared}\r\nConnection: close\r\n\r\n"), body.clone()),
                            Some(Resp::Status(c)) => (format!("HTTP/1.1 {c} X\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"), vec![]),
                            None => ("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".to_string(), vec![]),
                        };
                        let _ = s.write_all(head.as_bytes()).await;
                        let _ = s.write_all(&body).await;
                        let _ = s.shutdown().await;
                    });
                }
            });
            format!("http://{addr}")
        }

        fn leftovers(dir: &Path) -> bool {
            dir.join("delta.apk").exists() || dir.join("delta.part").exists()
        }

        #[tokio::test]
        async fn release_download_failures_are_coded_and_leave_nothing_behind() {
            let apk = vec![5u8; 10_000];
            let sums = format!("{}  {APK}\n", hex(&Sha256::digest(&apk).into()));
            let c = reqwest::Client::new();
            let run = |base: String, size_hint: u64, dir: PathBuf| async move {
                let r = download_release_from(&reqwest::Client::new(), |n| format!("{base}/{n}"), APK, size_hint, &dir, |_| {}).await;
                (r, dir)
            };

            // happy path returns the digest of the stream
            let base = serve_routes(vec![("/SHA256SUMS", Resp::Ok(sums.clone().into_bytes())), ("/Delta-Android-arm64-x86_64.apk", Resp::Ok(apk.clone()))]).await;
            let (r, dir) = run(base, 10_000, tmp()).await;
            assert_eq!(r.unwrap().1, <[u8; 32]>::from(Sha256::digest(&apk)));
            assert!(dir.join("delta.apk").exists());

            // SHA256SUMS over 4 KiB
            let base = serve_routes(vec![("/SHA256SUMS", Resp::Ok(vec![b'x'; MAX_SUMS_BYTES + 1]))]).await;
            let (r, dir) = run(base, 0, tmp()).await;
            assert_eq!(r.unwrap_err(), "size_limit");
            assert!(!leftovers(&dir));

            // no line for the asset
            let base = serve_routes(vec![("/SHA256SUMS", Resp::Ok(format!("{}  other.apk\n", "aa".repeat(32)).into_bytes()))]).await;
            let (r, dir) = run(base, 0, tmp()).await;
            assert_eq!(r.unwrap_err(), "checksum_missing");
            assert!(!leftovers(&dir));

            // the APK is missing (404), and so is SHA256SUMS
            let base = serve_routes(vec![("/SHA256SUMS", Resp::Ok(sums.clone().into_bytes()))]).await;
            let (r, dir) = run(base, 0, tmp()).await;
            assert_eq!(r.unwrap_err(), "download_http_404");
            assert!(!leftovers(&dir));
            let (r, _) = run(serve_routes(vec![]).await, 0, tmp()).await;
            assert_eq!(r.unwrap_err(), "download_http_404");

            // connection cut mid-stream: fewer bytes than Content-Length
            let base = serve_routes(vec![("/SHA256SUMS", Resp::Ok(sums.clone().into_bytes())), ("/Delta-Android-arm64-x86_64.apk", Resp::Cut { declared: 10_000, body: apk[..3_000].to_vec() })]).await;
            let (r, dir) = run(base, 0, tmp()).await;
            assert_eq!(r.unwrap_err(), "network_failed");
            assert!(!leftovers(&dir), "neither .part nor apk");

            // Content-Length above the limit: refused before anything is written
            let base = serve_routes(vec![("/a.apk", Resp::Cut { declared: 10_000, body: vec![] })]).await;
            let dir = tmp();
            assert_eq!(download_to(&c, &format!("{base}/a.apk"), 100, &[0; 32], &dir.join("delta.apk"), |_| {}).await, Err("size_limit".into()));
            assert!(!leftovers(&dir));

            // plain status codes from download_to
            let base = serve_routes(vec![("/a.apk", Resp::Status(500))]).await;
            assert_eq!(download_to(&c, &format!("{base}/a.apk"), 100, &[0; 32], &dir.join("delta.apk"), |_| {}).await, Err("download_http_500".into()));
        }

        #[test]
        fn normalised_urls_are_checked_not_the_raw_string() {
            let ok = |s: &str, hop| allowed_reqwest_url(&reqwest::Url::parse(s).unwrap(), hop);
            assert!(ok("HTTPS://OBJECTS.GITHUBUSERCONTENT.COM/a", 1), "host is lower-cased by the parser");
            assert!(ok("https://objects.githubusercontent.com:443/a", 1), "the default port is dropped by the parser");
            assert!(ok(&asset_url("0.1.16", APK).unwrap(), 0));
            for bad in ["https://objects.githubusercontent.com./a", "https://objects.githubusercontent.com%2eevil.com/a", "https://objects.githubusercontent.com:8443/a", "https://u:p@objects.githubusercontent.com/a", "http://objects.githubusercontent.com/a"] {
                assert!(!reqwest::Url::parse(bad).map(|u| allowed_reqwest_url(&u, 1)).unwrap_or(false), "{bad}");
            }
            assert!(!ok("https://objects.githubusercontent.com/a", MAX_REDIRECTS + 1) && !ok("https://objects.githubusercontent.com/a", 0));
        }

        #[tokio::test]
        async fn verified_download_lands_only_when_the_checksum_matches() {
            let body = vec![7u8; 100_000];
            let url = serve(body.clone()).await;
            let good: [u8; 32] = Sha256::digest(&body).into();
            let dir = tmp();
            let c = reqwest::Client::new();
            let mut last = 0;
            assert_eq!(download_to(&c, &url, 1_000_000, &good, &dir.join("delta.apk"), |n| last = n).await, Ok(good));
            assert_eq!(last, 100_000);
            assert_eq!(std::fs::read(dir.join("delta.apk")).unwrap(), body);
            assert!(!dir.join("delta.part").exists());

            let _ = std::fs::remove_file(dir.join("delta.apk"));
            assert_eq!(download_to(&c, &url, 1_000_000, &[0u8; 32], &dir.join("delta.apk"), |_| {}).await, Err("checksum_mismatch".into()));
            assert!(!dir.join("delta.apk").exists() && !dir.join("delta.part").exists(), "nothing installable is left behind");
            assert_eq!(download_to(&c, &url, 50_000, &good, &dir.join("delta.apk"), |_| {}).await, Err("size_limit".into()));
            assert!(!dir.join("delta.apk").exists() && !dir.join("delta.part").exists());
            let _ = std::fs::remove_dir_all(dir);
        }
    }
}
