/** The root document owns routing; only genuinely external HTTP(S) links use the OS. */
export function isExternalHttpLink(href: string, documentUrl: string): boolean {
  const root = new URL(documentUrl);
  const target = new URL(href, root);
  if (!["http:", "https:"].includes(target.protocol)) return false;
  // Compare the actual bundled origin, never a hard-coded tauri.localhost name.
  return target.origin !== root.origin;
}
export function installNativeLinkHandler(
  doc: Document,
  open: (url: string) => Promise<unknown>,
): () => void {
  const click = (event: MouseEvent) => {
    const anchor = event
      .composedPath()
      .find((node) => node instanceof doc.defaultView!.HTMLAnchorElement) as
      HTMLAnchorElement | undefined;
    if (
      !anchor ||
      event.defaultPrevented ||
      !isExternalHttpLink(anchor.href, doc.URL)
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    void open(anchor.href).catch(() => {
      /* OS adapter reports errors separately; never navigate the privileged root. */
    });
  };
  doc.addEventListener("click", click, true);
  return () => doc.removeEventListener("click", click, true);
}
