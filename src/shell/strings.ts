import { tr } from "../i18n";
import en from "../i18n/en.json";
export type ShellWord = keyof typeof en.shell;
export function s(key: ShellWord, params: Record<string, string | number> = {}) {
  return tr("shell." + key, params);
}
