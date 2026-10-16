import { z } from "zod";
const token = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/);
/** Declarative presentation only. App surfaces cannot supply JS, URLs or host grants. */
export const uiContributionsSchema = z
  .object({
    version: z.literal(1),
    surfaces: z
      .array(
        z
          .object({
            id: token,
            name: z
              .object({
                en: z.string().min(1).max(80),
                ru: z.string().min(1).max(80).optional(),
              })
              .strict(),
            icon: z.string().regex(/^[a-z0-9-]{1,70}$/),
            kind: z.enum(["page", "panel", "widget"]),
            minWidth: z.number().int().min(160).max(1920),
            minHeight: z.number().int().min(80).max(1080),
            instance: z.literal("shared"),
            requires: z.array(z.string().max(100)).max(16).default([]),
          })
          .strict(),
      )
      .max(64),
  })
  .strict()
  .superRefine((v, ctx) => {
    const ids = v.surfaces.map((s) => s.id);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: "custom", message: "Duplicate surface ID" });
  });
export type UiContributions = z.infer<typeof uiContributionsSchema>;
export function readUiContributions(manifest: unknown): UiContributions | null {
  const r = uiContributionsSchema.safeParse((manifest as { ui?: unknown })?.ui);
  return r.success ? r.data : null;
}
const installedSurfaceAppSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z][a-z0-9]*(?:\.[a-z0-9]+)+$/)
    .max(120),
  name: z.string().min(1).max(120),
  ui: uiContributionsSchema,
});
/** A host response is still input: isolate malformed metadata instead of breaking the workspace. */
export function readInstalledSurfaceApps(
  value: unknown,
): z.infer<typeof installedSurfaceAppSchema>[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, 128).flatMap((item) => {
    const r = installedSurfaceAppSchema.safeParse(item);
    if (!r.success || seen.has(r.data.id)) return [];
    seen.add(r.data.id);
    return [r.data];
  });
}
