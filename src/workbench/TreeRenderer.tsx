import { Canvas } from "./Canvas";
import {
  useRef,
  useEffect,
  type ReactNode,
  type CSSProperties,
} from "react";
import type { Application, Tree } from "./model";
import type { WorkbenchProps } from "./Workbench";
import { LocalMedia, Notes, WebView, OfflineView } from "./LocalViews";
import { WIcon } from "./Icon";
import { t } from "./strings";
import { useResolvedTheme } from "../app/theme";
import { DesktopHome } from "./DesktopHome";
interface TreeProps extends WorkbenchProps {
  tree: Tree;
  apps: Application[];
  edit: boolean;
  selected: string;
  onSelect: (id: string) => void;
  onChange: (tree: Tree) => void;
  onAdd: (kind: "notes" | "files" | "web") => void;
  onAppChange: (id: string, root: Tree) => void;
  path: string[];
}
export function TreeRenderer(p: TreeProps) {
  const { tree: n, edit, selected, onSelect, onChange } = p;
  const scheme = useResolvedTheme();
  const dragCleanup = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => dragCleanup.current?.(), []);
  const child = (c: Tree) => (
    <TreeRenderer
      {...p}
      key={c.id}
      tree={c}
      onChange={(next) => {
        if (n.type !== "view")
          onChange({
            ...n,
            children: n.children.map((v) => (v.id === c.id ? next : v)),
          });
      }}
    />
  );
  const drag = (
    e: React.PointerEvent,
    fn: (dx: number, dy: number) => void,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    dragCleanup.current?.();
    const x = e.clientX,
      y = e.clientY;
    const move = (ev: PointerEvent) => fn(ev.clientX - x, ev.clientY - y);
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    dragCleanup.current = end;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };
  // During a pointer operation, callbacks must use the freshest draft, not stale parent state.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  let content: ReactNode;
  const activeTab =
    n.type === "tabs"
      ? (
          n.children.find((c) => c.id === n.active && (edit || !c.hidden)) ||
          n.children.find((c) => edit || !c.hidden)
        )?.id
      : undefined;
  if (n.type === "view") {
    if (n.kind === "notes") content = <Notes id={n.id} />;
    else if (n.kind === "files") content = <LocalMedia />;
    else if (n.kind === "web") content = <WebView id={n.id} />;
    else if (n.kind === "welcome") content = <DesktopHome live={p.live} />;
    else if (n.kind === "app") {
      const app = p.apps.find((a) => a.id === n.target);
      content =
        app && !p.path.includes(app.id) ? (
          <div className="wb-embedded">
            <TreeRenderer
              {...p}
              tree={app.root}
              edit={false}
              path={[...p.path, app.id]}
              onChange={(next) => p.onAppChange(app.id, next)}
            />
          </div>
        ) : (
          <div className="wb-empty">{t("unsupported")}</div>
        );
    } else if (p.live && p.renderView)
      content = p.renderView(
        n,
        scheme,
        p.apps.find((a) => a.id === p.path[p.path.length - 1])!,
      );
    else if (n.kind === "plugin" && n.target === "dev.delta.media")
      content = <LocalMedia />;
    else content = <OfflineView node={n} onAdd={p.onAdd} />;
  } else if (n.type === "tabs")
    content = (
      <>
        <div className="wb-tabs" role="tablist">
          {n.children
            .filter((c) => !c.hidden || edit)
            .map((c) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={activeTab === c.id}
                className={activeTab === c.id ? "active" : ""}
                onClick={() => {
                  onChange({ ...n, active: c.id });
                  if (edit) onSelect(c.id);
                }}
              >
                <WIcon name={c.icon} size={18} />
                <span>{c.title}</span>
              </button>
            ))}
        </div>
        <div className="wb-tab-content">
          {n.children.map((c) => (
            <div
              key={c.id}
              role="tabpanel"
              hidden={c.id !== activeTab}
              className="wb-tab-panel"
            >
              {child(c)}
            </div>
          ))}
        </div>
      </>
    );
  else if (n.type === "split")
    content = (
      <div
        className={"wb-split wb-axis-" + n.axis}
        style={{ "--wb-ratio": n.ratio } as CSSProperties}
      >
        {child(n.children[0])}
        <div
          role="separator"
          aria-orientation={n.axis === "row" ? "vertical" : "horizontal"}
          tabIndex={0}
          aria-label={t("split")}
          className="wb-split-handle"
          onKeyDown={(e) => {
            if (
              ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(
                e.key,
              )
            ) {
              e.preventDefault();
              const delta = ["ArrowLeft", "ArrowUp"].includes(e.key)
                ? -0.05
                : 0.05;
              onChange({
                ...n,
                ratio: Math.max(0.15, Math.min(0.85, n.ratio + delta)),
              });
            }
          }}
          onPointerDown={(e) => {
            const box = e.currentTarget.parentElement!.getBoundingClientRect();
            drag(e, (dx, dy) =>
              onChangeRef.current({
                ...n,
                ratio: Math.max(
                  0.15,
                  Math.min(
                    0.85,
                    n.ratio +
                      (n.axis === "row" ? dx / box.width : dy / box.height),
                  ),
                ),
              }),
            );
          }}
        />
        {child(n.children[1])}
      </div>
    );
  else content = <Canvas tree={n} palette={p.palette} render={child} onChange={onChange} edit={edit} onSelect={onSelect} />;
  return (
    <section
      className={
        "wb-tree wb-tree-" +
        n.type +
        (selected === n.id && edit ? " wb-selected" : "") +
        (n.hidden && edit ? " wb-is-hidden" : "")
      }
      hidden={!!n.hidden && !edit}
      onClickCapture={(e) => {
        if (
          edit &&
          (e.target as HTMLElement).closest(".wb-tree") === e.currentTarget
        )
          onSelect(n.id);
      }}
    >
      {edit && (
        <button
          className="wb-select-label"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(n.id);
          }}
        >
          <WIcon name={n.icon} size={14} />
          {n.title}
        </button>
      )}
      {content}
    </section>
  );
}
