import { control } from "../api/control";
import { validateWorkspace, type Workspace } from "./model";
export function nodeWorkspace() {
  let revision: number | undefined;
  return {
    async load() {
      const r = await control("web.workspace_get");
      revision = r.revision;
      return r.workspace ? validateWorkspace(r.workspace) : null;
    },
    async save(state: Workspace) {
      if (revision === undefined) {
        const r = await control("web.workspace_get");
        revision = r.revision;
      }
      await control("web.workspace_put", {
        workspace: validateWorkspace(state),
        revision,
      }).then((r) => {
        revision = r.revision;
      });
    },
  };
}
