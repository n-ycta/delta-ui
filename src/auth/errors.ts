import { tr } from "../i18n";
/** Stable explanations for old and current Core versions; never echo secret inputs. */
export function authError(error: unknown): string {
  const e = error as { message?: string; code?: string; status?: number };
  const message = e?.message || "";
  if (message.includes("public key is not enrolled"))
    return tr("auth.keyNotEnrolled");
  if (message.includes("origin is not configured"))
    return tr("auth.originNotAllowed");
  if (
    /Setup link expired|setup link expired|expired or consumed/i.test(message)
  )
    return tr("auth.linkExpired");
  if (/challenge expired|invalid or consumed challenge/.test(message))
    return tr("auth.challengeExpired");
  if (e?.status === 401 || e?.code === "unauthorized")
    return tr("auth.accessExpired");
  if (e?.code === "rate_limited") return tr("auth.rateLimited");
  return message || tr("polish.requestFailed");
}
