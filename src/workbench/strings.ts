import { tr } from "../i18n";
import en from "../i18n/en.json";
export type Word = keyof typeof en.workbench;
export function t(key: Word, params: Record<string, string | number> = {}) {
  return tr("workbench." + key, params);
}
