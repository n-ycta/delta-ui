import { hostBridge } from "../host/contract";
import { readConnectionSettings } from "../api";
/** Root-document app management only. Never pass this transport to a plugin frame. */
export async function appCall(
  capability: string,
  args: Record<string, unknown> = {},
): Promise<any> {
  if (!/^host\.apps_(catalog|list|install|remove|launch)$/.test(capability))
    throw Error("forbidden");
  const host = hostBridge();
  if (host) return host.call({ capability, args });
  const method = capability.slice("host.apps_".length);
  const read = method === "catalog" || method === "list";
  const token = readConnectionSettings().token;
  const response = await fetch("/apps/" + method, {
    method: read ? "GET" : "POST",
    credentials: "same-origin",
    headers: {
      ...(!read ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: "Bearer " + token } : {}),
    },
    ...(!read ? { body: JSON.stringify(args) } : {}),
  });
  const value = await response.json();
  if (!response.ok) throw Error(value.error || "app_operation_failed");
  return value;
}
