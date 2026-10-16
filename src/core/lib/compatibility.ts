import { compare } from "./semver";
export interface RuntimeSupport {
  targets: string[];
  minAgent?: string;
  platforms?: string[];
  architectures?: string[];
  execution?: "process" | "embedded" | "web";
}
export interface Device {
  kind: string;
  os: string;
  arch: string;
  agentVersion: string;
  status: string;
}
/** UI explanation only. The target Core must independently authorize and validate installation. */
export function incompatibility(
  runtime: RuntimeSupport,
  node: Device,
): string | null {
  if (!runtime.targets.includes(node.kind)) return "target";
  if (node.status === "offline" || node.status === "connecting")
    return "offline";
  if (runtime.minAgent && compare(node.agentVersion, runtime.minAgent) < 0)
    return "version";
  if (node.kind === "android" && (runtime.execution || "process") === "process")
    return "process";
  const os =
    node.kind === "android"
      ? "android"
      : /windows/i.test(node.os)
        ? "windows"
        : /linux/i.test(node.os)
          ? "linux"
          : /darwin|macos/i.test(node.os)
            ? "macos"
            : "unknown";
  if (runtime.platforms?.length && !runtime.platforms.includes(os))
    return "platform";
  const arch =
    (
      { aarch64: "arm64", x86_64: "x64", amd64: "x64" } as Record<
        string,
        string
      >
    )[node.arch] || node.arch;
  if (runtime.architectures?.length && !runtime.architectures.includes(arch))
    return "architecture";
  return null;
}
