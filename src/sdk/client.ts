/** App-side half of the grant-limited Plugin UI channel. No host token or IPC access. */
export interface AppContext {
  appId: string;
  language: "en" | "ru";
  theme: "light" | "dark";
}
export function connectPlugin(
  parentOrigin: string,
  timeoutMs = 5000,
): Promise<{
  context: AppContext;
  call(capability: string, args?: Record<string, unknown>): Promise<unknown>;
  close(): void;
}> {
  if (parent === window) return Promise.reject(Error("not_embedded"));
  const parentURL = new URL(parentOrigin);
  const origin =
    parentURL.origin === "null"
      ? parentURL.protocol + "//" + parentURL.host
      : parentURL.origin;
  if (!["http:", "https:", "tauri:"].includes(parentURL.protocol))
    return Promise.reject(Error("invalid_parent"));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener("message", receive);
      reject(Error("host_timeout"));
    }, timeoutMs);
    function receive(e: MessageEvent) {
      if (
        e.source !== parent ||
        e.origin !== origin ||
        e.data?.type !== "delta:initialize" ||
        typeof e.data.channel !== "string" ||
        e.data.channel.length > 80
      )
        return;
      const context = e.data.context as AppContext;
      if (
        !context ||
        !["en", "ru"].includes(context.language) ||
        !["light", "dark"].includes(context.theme) ||
        typeof context.appId !== "string"
      )
        return;
      clearTimeout(timer);
      window.removeEventListener("message", receive);
      const channel = e.data.channel;
      const pending = new Map<
        string,
        {
          resolve(v: unknown): void;
          reject(e: Error): void;
          timer: ReturnType<typeof setTimeout>;
        }
      >();
      let closed = false;
      const reply = (event: MessageEvent) => {
        if (
          event.source !== parent ||
          event.origin !== origin ||
          event.data?.channel !== channel
        )
          return;
        const p = pending.get(event.data.id);
        if (!p) return;
        clearTimeout(p.timer);
        pending.delete(event.data.id);
        event.data.ok
          ? p.resolve(event.data.result)
          : p.reject(Error(event.data.error?.code || "operation_failed"));
      };
      window.addEventListener("message", reply);
      resolve({
        context,
        call(capability, args = {}) {
          if (closed) return Promise.reject(Error("channel_closed"));
          if (pending.size >= 4) return Promise.reject(Error("busy"));
          return new Promise((resolve, reject) => {
            const id = crypto.randomUUID();
            const timer = setTimeout(() => {
              pending.delete(id);
              reject(Error("host_timeout"));
            }, timeoutMs);
            pending.set(id, { resolve, reject, timer });
            parent.postMessage(
              { channel, id, request: { capability, args } },
              origin,
            );
          });
        },
        close() {
          closed = true;
          window.removeEventListener("message", reply);
          for (const p of pending.values()) {
            clearTimeout(p.timer);
            p.reject(Error("channel_closed"));
          }
          pending.clear();
        },
      });
    }
    window.addEventListener("message", receive);
    parent.postMessage({ type: "delta:ready" }, origin);
  });
}
