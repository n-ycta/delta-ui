import { Button, Modal } from "./WorkbenchControls";
import { Appearance } from "./Appearance";
import { Outline } from "./Outline";
import { TreeRenderer } from "./TreeRenderer";
import { Select } from "../ui/Select";
import { HomeAppearance } from "./HomeAppearance";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  cloneTree,
  mapTree,
  removeTree,
  uid,
  validateWorkspace,
  view,
  visit,
  type Application,
  type Tree,
  type Workspace,
  type ViewKind,
} from "./model";
import { loadBackup, loadWorkspace, persist, download } from "./storage";
import { template, templateNames } from "./templates";
import { iconNames, WIcon } from "./Icon";
import { t, type Word } from "./strings";
import { language, setLanguage } from "../i18n";

import "./workbench.css";
export interface PaletteItem {
  key: string;
  title: string;
  icon: string;
  kind: ViewKind;
  target?: string;
}
export interface WorkbenchProps {
  demo?: boolean;
  palette?: PaletteItem[];
  overlay?: ReactNode;
  live?: boolean;
  remote?: {
    load: () => Promise<Workspace | null>;
    save: (s: Workspace) => Promise<void>;
  };
  renderView?: (
    node: Tree,
    theme: "light" | "dark",
    appearance: Application,
  ) => ReactNode;
}
export function Workbench({
  live = false,
  renderView,
  remote,
  overlay,
  demo = false,
  palette = [],
}: WorkbenchProps) {
  const initial = useRef(loadWorkspace());
  const [state, setState] = useState<Workspace>(initial.current.state),
    [error, setError] = useState(
      initial.current.recovered ? t("storageError") : "",
    ),
    [edit, setEdit] = useState(false),
    [selected, setSelected] = useState(""),
    [modal, setModal] = useState<
      "settings" | "add" | "icons" | "templates" | null
    >(null),
    [level, setLevel] = useState("simple"),
    [search, setSearch] = useState(""),
    [iconPurpose, setIconPurpose] = useState<"node" | "app" | "brand">("app"),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [inspector, setInspector] = useState<"structure" | "appearance">(
      "structure",
    );
  const past = useRef<Workspace[]>([]),
    future = useRef<Workspace[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [historyVersion, setHistoryVersion] = useState(0);
  const [mounted, setMounted] = useState<Set<string>>(
    () => new Set([state.active]),
  );
  const active = state.apps.find((a) => a.id === state.active)!;
  const commit = useCallback((next: Workspace) => {
    try {
      const validated = validateWorkspace(next);
      past.current = [...past.current.slice(-39), stateRef.current];
      future.current = [];
      setState(validated);
      setHistoryVersion((v) => v + 1);
      setError("");
    } catch (e) {
      setError(String(e));
    }
  }, []);
  const patchApp = (changes: Partial<Application>) =>
    commit({
      ...state,
      apps: state.apps.map((a) =>
        a.id === state.active ? { ...a, ...changes } : a,
      ),
    });
  const patchNode = (id: string, fn: (n: Tree) => Tree) =>
    patchApp({ root: mapTree(active.root, id, fn) });
  const switchApp = (id: string) => {
    setMounted((s) => new Set([...s, id]));
    setSelected("");
    setState((s) => ({ ...s, active: id }));
  };
  const travel = (back: boolean) => {
    const from = back ? past : future,
      to = back ? future : past;
    const next = from.current.pop();
    if (!next) return;
    to.current.push(state);
    setState(next);
    setHistoryVersion((v) => v + 1);
  };
  const toggleEditor = useCallback(() => setEdit((v) => !v), []);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        persist(state);
      } catch {
        setError(t("storageError"));
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [state]);
  useEffect(() => {
    setMounted((s) => new Set([...s, state.active]));
  }, [state.active]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "e"
      ) {
        e.preventDefault();
        toggleEditor();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "r"
      ) {
        e.preventDefault();
        setModal("settings");
      }
    };
    const choose = () => setModal("settings");
    window.addEventListener("delta:workbench-choose", choose);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("delta:workbench-choose", choose);
    };
  }, [toggleEditor]);
  let selection: Tree | undefined;
  visit(active.root, (n) => {
    if (n.id === selected) selection = n;
  });
  let hidden = 0;
  visit(active.root, (n) => {
    if (n.hidden) hidden++;
  });
  const duplicate = () => {
    const id = uid();
    const app = {
      ...active,
      id,
      name: active.name + " · " + t("copy"),
      root: cloneTree(active.root),
    };
    commit({ ...state, active: id, apps: [...state.apps, app] });
  };
  const insert = (
    kind: ViewKind,
    target?: string,
    title?: string,
    icon?: string,
  ) => {
    const name = title || t(kind as Word),
      node = view(
        kind,
        name,
        icon ||
          {
            notes: "note-pencil",
            files: "play-circle",
            web: "globe",
            system: "squares-four",
            plugin: "puzzle-piece",
            app: "app-window",
            welcome: "house",
          }[kind],
        target,
      );
    let root = active.root;
    const spot = selection || root;
    if (kind === "plugin") {
      let exists = false;
      visit(root, (n) => {
        if (n.type === "view" && n.kind === "plugin" && n.target === target)
          exists = true;
      });
      if (exists) {
        setError(t("single"));
        return;
      }
    }
    root = mapTree(root, spot.id, (n) => {
      if (n.type === "canvas")
        return {
          ...n,
          children: [...n.children, node],
          rects: {
            ...n.rects,
            [node.id]: {
              x: 48 + n.children.length * 36,
              y: 48 + n.children.length * 36,
              w: 480,
              h: 360,
            },
          },
        };
      if (n.type === "tabs")
        return { ...n, active: node.id, children: [...n.children, node] };
      return {
        id: uid(),
        title: t("tabs"),
        icon: "tabs",
        type: "tabs",
        active: node.id,
        children: [n, node],
      };
    });
    patchApp({ root });
    setModal(null);
    setSelected(node.id);
  };
  const wrap = (type: "tabs" | "split" | "canvas") => {
    const target = selection || active.root;
    const newChild = view("notes", t("notes"), "note-pencil");
    patchNode(target.id, (n) => {
      const common = {
        id: uid(),
        title: t(type === "canvas" ? "window" : type),
        icon:
          type === "tabs"
            ? "tabs"
            : type === "split"
              ? "columns"
              : "selection-all",
        children: [n, ...(type === "split" ? [newChild] : [])],
      };
      return type === "tabs"
        ? { ...common, type, active: n.id }
        : type === "split"
          ? { ...common, type, axis: "row", ratio: 0.5 }
          : {
              ...common,
              type,
              camera: { x: 0, y: 0, zoom: 1 },
              rects: { [n.id]: { x: 24, y: 24, w: 520, h: 420 } },
            };
    });
  };
  const importFile = async (file: File) => {
    try {
      if (file.size > 500000) throw Error("500 KB limit");
      const next = validateWorkspace(JSON.parse(await file.text()));
      commit(next);
      setMounted(new Set([next.active]));
      setModal(null);
    } catch (e) {
      setError(t("importError") + String(e));
    }
  };
  const input = useRef<HTMLInputElement>(null);
  const iconSearch = iconNames
    .filter((n) => n.includes(search.toLowerCase()))
    .slice(0, 96);
  const style = {
    "--wb-accent": active.accent,
    "--wb-gap": active.gap + "px",
    "--wb-radius": active.radius + "px",
  } as CSSProperties;
  return (
    <div
      className={"wb" + (edit ? " wb-edit" : "")}
      data-wb-theme={active.theme}
      data-wb-chrome={active.chrome}
      data-wb-nav={active.nav}
      data-wb-mobile={active.mobileNav}
      style={style}
    >
      <header className="wb-topbar">
        <div className="wb-brand">
          {active.logo &&
            (active.brandSymbol !== "delta" ? (
              <WIcon name={active.brandSymbol} size={30} />
            ) : (
              <svg
                width="30"
                height="30"
                viewBox="0 0 32 32"
                aria-label="Delta"
              >
                <path
                  d="M4 26 16 5l11 19M4 26h18"
                  fill="none"
                  stroke="#7758ff"
                  strokeWidth="3.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="28" cy="27" r="2.4" fill="#ff743e" />
              </svg>
            ))}
          {active.brand && <strong>{active.brandName}</strong>}
        </div>
        <div className="wb-breadcrumb">
          <span>{t("apps")}</span>
          <WIcon name="caret-right" size={14} />
          <b>{active.name}</b>
        </div>
        <div className="wb-top-actions">
          <span className="wb-mode">
            <i />
            {demo ? t("demo") : live ? t("core") : t("local")}
          </span>
          <Button
            icon="plus"
            label={t("add")}
            onClick={() => {
              setSearch("");
              setModal("add");
            }}
          />
          <Button
            icon={edit ? "check" : "sliders-horizontal"}
            label={edit ? t("done") : t("edit")}
            active={edit}
            onClick={toggleEditor}
          />
          <Button
            icon="gear-six"
            label={t("settings")}
            active={modal === "settings"}
            onClick={() => setModal("settings")}
          />
        </div>
      </header>
      {!active.chrome && (
        <div className="wb-recovery-dock">
          {demo && <span>{t("demo")}</span>}
          <Button
            icon="squares-four"
            label={t("apps")}
            onClick={() => setModal("settings")}
          />
          <Button
            icon={edit ? "check" : "sliders-horizontal"}
            label={edit ? t("done") : t("edit")}
            onClick={toggleEditor}
          />
          <Button
            icon="gear-six"
            label={t("settings")}
            onClick={() => setModal("settings")}
          />
        </div>
      )}
      <nav className="wb-nav" aria-label={t("apps")}>
        <div className="wb-nav-caption">{t("apps")}</div>
        {state.apps.map((a) => (
          <button
            key={a.id}
            className={a.id === state.active ? "active" : ""}
            title={a.name}
            onClick={() => switchApp(a.id)}
          >
            <WIcon name={a.icon} />
            <span>{a.name}</span>
          </button>
        ))}
        <div className="wb-nav-spacer" />
        <button onClick={() => setModal("templates")}>
          <WIcon name="squares-four" />
          <span>{t("templates")}</span>
        </button>
      </nav>
      <main className="wb-main">
        {error && (
          <div role="alert" className="wb-warning">
            <span>{error}</span>
            <Button icon="x" label={t("close")} onClick={() => setError("")} />
          </div>
        )}
        {edit && (
          <div className="wb-editor-toolbar">
            <div>
              <WIcon name="sliders-horizontal" />
              <strong>{t("edit")}</strong>
            </div>
            <div className="wb-toolbar-actions">
              <Button
                icon="arrow-u-up-left"
                label={t("undo")}
                disabled={!past.current.length}
                onClick={() => travel(true)}
              />
              <Button
                icon="arrow-u-up-right"
                label={t("redo")}
                disabled={!future.current.length}
                onClick={() => travel(false)}
              />
              <button className="wb-primary" onClick={() => setEdit(false)}>
                <WIcon name="check" />
                {t("done")}
              </button>
            </div>
          </div>
        )}
        <div className="wb-stage">
          {state.apps
            .filter((a) => mounted.has(a.id) || a.id === state.active)
            .map((a) => (
              <div
                key={a.id}
                className="wb-app-surface"
                hidden={a.id !== state.active}
                data-wb-theme={a.theme}
                style={
                  {
                    "--wb-accent": a.accent,
                    "--wb-gap": a.gap + "px",
                    "--wb-radius": a.radius + "px",
                  } as CSSProperties
                }
              >
                <TreeRenderer
                  tree={a.root}
                  apps={state.apps}
                  live={live}
                  renderView={renderView}
                  edit={edit && a.id === state.active}
                  selected={selected}
                  onSelect={setSelected}
                  onChange={(root) => {
                    if (a.id === state.active) patchApp({ root });
                  }}
                  onAdd={(kind) => insert(kind)}
                  onAppChange={(id, root) =>
                    commit({
                      ...state,
                      apps: state.apps.map((a) =>
                        a.id === id ? { ...a, root } : a,
                      ),
                    })
                  }
                  path={[a.id]}
                />
              </div>
            ))}
        </div>
      </main>
      {edit && (
        <aside className="wb-inspector">
          <div className="wb-inspector-tabs">
            {(["structure", "appearance"] as const).map((k) => (
              <button
                key={k}
                className={inspector === k ? "active" : ""}
                onClick={() => setInspector(k)}
              >
                {t(k)}
              </button>
            ))}
          </div>
          <div className="wb-inspector-body">
            <label>
              {t("level")}
              <Select value={level} onChange={(e) => setLevel(e.target.value)}>
                {["simple", "advanced", "expert"].map((l) => (
                  <option key={l} value={l}>
                    {t(l as Word)}
                  </option>
                ))}
              </Select>
            </label>
            {inspector === "appearance" ? (
              <>
                {active.template === "media" && (
                  <p className="wb-hint">{t("mediaDependency")}</p>
                )}
                <Appearance
                  app={active}
                  patch={patchApp}
                  chooseBrand={() => {
                    setIconPurpose("brand");
                    setSearch("");
                    setModal("icons");
                  }}
                />
                <HomeAppearance app={active} patch={patchApp} />
              </>
            ) : (
              <>
                <Outline
                  tree={active.root}
                  selected={selected}
                  onSelect={setSelected}
                />
                <button className="wb-wide" onClick={() => setModal("add")}>
                  <WIcon name="plus" />
                  {t("add")}
                </button>
                {selection && (
                  <>
                    <hr />
                    <label>
                      {t("rename")}
                      <input
                        maxLength={120}
                        value={selection.title}
                        onChange={(e) =>
                          patchNode(selection!.id, (n) => ({
                            ...n,
                            title: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <div className="wb-inspector-row">
                      <button
                        onClick={() => {
                          setSearch("");
                          setIconPurpose("node");
                          setModal("icons");
                        }}
                      >
                        <WIcon name={selection.icon} />
                        {t("icon")}
                      </button>
                      <button
                        onClick={() =>
                          patchNode(selection!.id, (n) => ({
                            ...n,
                            hidden: !n.hidden,
                          }))
                        }
                      >
                        <WIcon name={selection.hidden ? "eye" : "eye-slash"} />
                        {t(selection.hidden ? "show" : "hide")}
                      </button>
                    </div>
                    {level !== "simple" && (
                      <>
                        <div className="wb-inspector-row">
                          <button onClick={() => wrap("split")}>
                            <WIcon name="columns" />
                            {t("split")}
                          </button>
                          <button onClick={() => wrap("tabs")}>
                            <WIcon name="tabs" />
                            {t("tabs")}
                          </button>
                        </div>
                        <button
                          className="wb-wide"
                          onClick={() => wrap("canvas")}
                        >
                          <WIcon name="app-window" />
                          {t("window")}
                        </button>
                        {selection.type === "split" && (
                          <>
                            <label>
                              {t("split")}
                              <Select
                                value={selection.axis}
                                onChange={(e) =>
                                  patchNode(selection!.id, (n) =>
                                    n.type === "split"
                                      ? {
                                          ...n,
                                          axis: e.target.value as
                                            "row" | "column",
                                        }
                                      : n,
                                  )
                                }
                              >
                                <option value="row">{t("horizontal")}</option>
                                <option value="column">{t("vertical")}</option>
                              </Select>
                            </label>
                            <label>
                              {t("scale")}
                              <input
                                type="range"
                                min="15"
                                max="85"
                                value={selection.ratio * 100}
                                onChange={(e) =>
                                  patchNode(selection!.id, (n) =>
                                    n.type === "split"
                                      ? {
                                          ...n,
                                          ratio: Number(e.target.value) / 100,
                                        }
                                      : n,
                                  )
                                }
                              />
                            </label>
                          </>
                        )}
                        {selection.type !== "view" &&
                          selection.children.map((child, i) => (
                            <div className="wb-order" key={child.id}>
                              <span>{child.title}</span>
                              <Button
                                icon="arrow-up"
                                label={t("up")}
                                disabled={i === 0}
                                onClick={() =>
                                  patchNode(selection!.id, (n) => {
                                    if (n.type === "view") return n;
                                    const c = [...n.children];
                                    [c[i - 1], c[i]] = [c[i], c[i - 1]];
                                    return { ...n, children: c };
                                  })
                                }
                              />
                              <Button
                                icon="arrow-down"
                                label={t("down")}
                                disabled={false}
                                onClick={() =>
                                  patchNode(selection!.id, (n) => {
                                    if (
                                      n.type === "view" ||
                                      i === n.children.length - 1
                                    )
                                      return n;
                                    const c = [...n.children];
                                    [c[i], c[i + 1]] = [c[i + 1], c[i]];
                                    return { ...n, children: c };
                                  })
                                }
                              />
                            </div>
                          ))}
                      </>
                    )}
                    {selection.id !== active.root.id && (
                      <button
                        className="wb-wide wb-danger"
                        onClick={() => {
                          patchApp({
                            root: removeTree(active.root, selection!.id),
                          });
                          setSelected("");
                        }}
                      >
                        <WIcon name="trash" />
                        {t("remove")}
                      </button>
                    )}
                  </>
                )}
                {hidden > 0 && (
                  <p className="wb-warning">{t("hiddenWarn", { n: hidden })}</p>
                )}
              </>
            )}
            <hr />
            <p className="wb-hint">{t("permission")}</p>
          </div>
        </aside>
      )}
      <input
        type="file"
        hidden
        accept="application/json,.json"
        ref={input}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importFile(file);
          e.target.value = "";
        }}
      />
      {modal === "settings" && (
        <Modal title={t("settings")} onClose={() => setModal(null)} wide>
          <>
            {error && (
              <p role="alert" className="wb-warning">
                {error}
              </p>
            )}
            <div className="wb-settings-grid">
              <section>
                <h3>{t("application")}</h3>
                <label>
                  {t("rename")}
                  <input
                    value={active.name}
                    maxLength={120}
                    onChange={(e) =>
                      patchApp({ name: e.target.value || "Delta" })
                    }
                  />
                </label>
                <button
                  onClick={() => {
                    setSelected("");
                    setSearch("");
                    setIconPurpose("app");
                    setModal("icons");
                  }}
                >
                  <WIcon name={active.icon} />
                  {t("icon")}
                </button>
                {active.template === "media" && (
                  <p className="wb-hint">{t("mediaDependency")}</p>
                )}
                <Appearance
                  app={active}
                  patch={patchApp}
                  chooseBrand={() => {
                    setIconPurpose("brand");
                    setSearch("");
                    setModal("icons");
                  }}
                />
                <HomeAppearance app={active} patch={patchApp} />
              </section>
              <section>
                <h3>{t("apps")}</h3>
                <div className="wb-app-choices">
                  {state.apps.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => {
                        switchApp(a.id);
                        setModal(null);
                      }}
                    >
                      <WIcon name={a.icon} />
                      {a.name}
                    </button>
                  ))}
                </div>
                <div className="wb-setting-actions">
                  <button onClick={duplicate}>
                    <WIcon name="copy" />
                    {t("duplicate")}
                  </button>
                  <button
                    onClick={() => {
                      download(
                        "delta-workspace.json",
                        JSON.stringify(state, null, 2),
                      );
                    }}
                  >
                    <WIcon name="export" />
                    {t("export")}
                  </button>
                  <button onClick={() => input.current?.click()}>
                    <WIcon name="import" />
                    {t("import")}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(t("restoreAsk"))) {
                        const restored = template(
                          templateNames.includes(active.template as any)
                            ? (active.template as (typeof templateNames)[number])
                            : "console",
                        );
                        patchApp({ ...restored, id: active.id });
                      }
                    }}
                  >
                    <WIcon name="arrow-counter-clockwise" />
                    {t("reset")}
                  </button>
                  <button
                    onClick={() => {
                      try {
                        commit(loadBackup());
                      } catch (e) {
                        setError(String(e));
                      }
                    }}
                  >
                    <WIcon name="clock-counter-clockwise" />
                    {t("undo")}
                  </button>
                  <button
                    disabled={state.apps.length === 1}
                    onClick={() => {
                      if (confirm(t("deleteAsk"))) {
                        commit({
                          ...state,
                          active: state.apps.find((a) => a.id !== active.id)!
                            .id,
                          apps: state.apps.filter((a) => a.id !== active.id),
                        });
                        setModal(null);
                      }
                    }}
                  >
                    <WIcon name="trash" />
                    {t("remove")}
                  </button>
                </div>
                {remote && (
                  <>
                    <h3>{t("save")}</h3>
                    <div className="wb-setting-actions">
                      <button
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await remote.save(state);
                            setNotice(t("nodeSaved"));
                          } catch (e) {
                            setError(String(e));
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        <WIcon name="cloud-arrow-up" />
                        {t("nodeSave")}
                      </button>
                      <button
                        disabled={busy}
                        onClick={async () => {
                          if (!confirm(t("nodeLoadAsk"))) return;
                          setBusy(true);
                          try {
                            const next = await remote.load();
                            if (next) {
                              commit(next);
                              setNotice(t("nodeSaved"));
                            } else setNotice(t("nodeMissing"));
                          } catch (e) {
                            setError(String(e));
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        <WIcon name="cloud-arrow-down" />
                        {t("nodeLoad")}
                      </button>
                    </div>
                    {notice && (
                      <p role="status" className="wb-hint">
                        {notice}
                      </p>
                    )}
                  </>
                )}
                <h3>{t("language")}</h3>
                <Select
                  aria-label={t("language")}
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as "en" | "ru")}
                >
                  <option value="ru">{t("russian")}</option>
                  <option value="en">{t("english")}</option>
                </Select>
                <p className="wb-hint">{t("localNotice")}</p>
                <p className="wb-hint">{t("shortcut")}</p>
                <a
                  className="wb-security"
                  href={live ? "#/identity" : "#"}
                  onClick={(e) => {
                    if (!live) {
                      e.preventDefault();
                      setError(t("unavailable"));
                    }
                  }}
                >
                  <WIcon name="key" />
                  {t("security")}
                </a>
                {live && (
                  <a className="wb-security" href="#/settings?tab=profile">
                    <WIcon name="user-circle" />
                    {t("profile")}
                  </a>
                )}
              </section>
            </div>
          </>
        </Modal>
      )}
      {modal === "templates" && (
        <Modal title={t("templates")} onClose={() => setModal(null)} wide>
          <p className="wb-hint">{t("templateHint")}</p>
          <div className="wb-template-grid">
            {templateNames.map((k) => (
              <button
                key={k}
                onClick={() => {
                  const a = template(k);
                  commit({ ...state, apps: [...state.apps, a], active: a.id });
                  setModal(null);
                }}
              >
                <div className={"wb-template-preview " + k}>
                  <i />
                  <i />
                  <i />
                </div>
                <span>
                  <WIcon name={template(k).icon} />
                  {t(k)}
                  <WIcon name="plus" />
                </span>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {modal === "add" && (
        <Modal title={t("add")} onClose={() => setModal(null)} wide>
          <input
            className="wb-search"
            placeholder={t("search")}
            aria-label={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="wb-component-grid">
            {(["notes", "files", "web"] as const)
              .filter((k) => t(k).toLowerCase().includes(search.toLowerCase()))
              .map((k, i) => (
                <button key={k} onClick={() => insert(k)}>
                  <WIcon name={["note-pencil", "play-circle", "globe"][i]} />
                  {t(k)}
                </button>
              ))}
            {(
              [
                "console",
                "home",
                "plugins",
                "nodes",
                "events",
                "dashboards",
                "contracts",
                "mcp",
                "identity",
                "access",
                "settings",
              ] as const
            )
              .filter((k) => t(k).toLowerCase().includes(search.toLowerCase()))
              .map((k) => (
                <button
                  key={k}
                  onClick={() =>
                    insert(
                      "system",
                      k === "home" ? "/" : "/" + k,
                      t(k),
                      {
                        console: "squares-four",
                        contracts: "file-code",
                        home: "gauge",
                        plugins: "puzzle-piece",
                        nodes: "hard-drives",
                        events: "list-bullets",
                        dashboards: "squares-four",
                        mcp: "plugs-connected",
                        identity: "key",
                        access: "lock",
                        settings: "gear-six",
                      }[k],
                    )
                  }
                >
                  <WIcon
                    name={
                      k === "nodes"
                        ? "hard-drives"
                        : k === "plugins"
                          ? "puzzle-piece"
                          : "squares-four"
                    }
                  />
                  {t(k)}
                </button>
              ))}
          </div>
          {palette.length > 0 && (
            <>
              <h3>{t("existing")}</h3>
              <div className="wb-component-grid">
                {palette
                  .filter((p) =>
                    p.title.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((p) => (
                    <button
                      key={p.key}
                      onClick={() => insert(p.kind, p.target, p.title, p.icon)}
                    >
                      <WIcon name={p.icon} />
                      {p.title}
                    </button>
                  ))}
              </div>
            </>
          )}
          <h3>{t("apps")}</h3>
          <div className="wb-component-grid">
            {state.apps
              .filter((a) => a.id !== active.id)
              .map((a) => (
                <button
                  key={a.id}
                  onClick={() => insert("app", a.id, a.name, a.icon)}
                >
                  <WIcon name={a.icon} />
                  {a.name}
                </button>
              ))}
            <button
              onClick={() =>
                insert("plugin", "dev.delta.media", t("media"), "music-notes")
              }
            >
              <WIcon name="music-notes" />
              {t("media")}
            </button>
          </div>
          {level === "expert" && (
            <form
              className="wb-plugin-form"
              onSubmit={(e) => {
                e.preventDefault();
                const id = new FormData(e.currentTarget).get(
                  "plugin",
                ) as string;
                insert("plugin", id, id, "puzzle-piece");
              }}
            >
              <label>
                {t("pluginTarget")}
                <input
                  name="plugin"
                  required
                  pattern="[\w.\-]+"
                  maxLength={100}
                />
              </label>
              <button>{t("add")}</button>
            </form>
          )}
          <p className="wb-hint">{t("single")}</p>
        </Modal>
      )}
      {modal === "icons" && (
        <Modal
          title={t("icon") + " · " + iconNames.length}
          onClose={() => setModal(null)}
          wide
        >
          <input
            className="wb-search"
            placeholder="Phosphor…"
            aria-label={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="wb-icon-grid">
            {iconSearch.map((name) => (
              <Button
                key={name}
                icon={name}
                label={name}
                onClick={() => {
                  if (iconPurpose === "brand") patchApp({ brandSymbol: name });
                  else if (iconPurpose === "node" && selection)
                    patchNode(selection.id, (n) => ({ ...n, icon: name }));
                  else patchApp({ icon: name });
                  setModal(null);
                }}
              />
            ))}
          </div>
          {!iconSearch.length && <p>{t("empty")}</p>}
        </Modal>
      )}
      {overlay}
      <span hidden>{historyVersion}</span>
    </div>
  );
}
