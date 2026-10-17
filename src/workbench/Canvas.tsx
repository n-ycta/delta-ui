import { useEffect, useRef, useState, type PointerEvent as RPointer } from 'react';
import { createPortal } from 'react-dom';
import type { Tree } from './model';
import { view } from './model';
import type { PaletteItem } from './Workbench';
import { WIcon } from './Icon';
import { Button } from './WorkbenchControls';
import { t } from './strings';

type CanvasTree = Extract<Tree, { type: 'canvas' }>;
type Rect = CanvasTree['rects'][string];
export function Canvas({ tree, palette = [], render, onChange, edit, onSelect }: {
  tree: CanvasTree; palette?: PaletteItem[]; render: (tree: Tree) => React.ReactNode;
  onChange: (tree: Tree) => void; edit: boolean; onSelect: (id: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null), world = useRef<HTMLDivElement>(null);
  const latest = useRef(tree), change = useRef(onChange);
  latest.current = tree; change.current = onChange;
  const [front, setFront] = useState(''), [min, setMin] = useState<string[]>([]);
  const [menu, setMenu] = useState<{ x: number; y: number; wx: number; wy: number } | null>(null);
  const [filter, setFilter] = useState('');
  const cleanup = useRef<() => void>(() => {}), camera = useRef(tree.camera);
  const active = useRef(false), space = useRef(false), wheelSave = useRef<ReturnType<typeof setTimeout>>();
  camera.current = active.current ? camera.current : tree.camera;
  const paintCamera = () => {
    const c = camera.current;
    if (world.current) world.current.style.transform = `translate3d(${c.x}px,${c.y}px,0) scale(${c.zoom})`;
    const label = root.current?.querySelector('[data-zoom]');
    if (label) label.textContent = Math.round(c.zoom * 100) + '%';
  };
  const saveCamera = () => { active.current = false; change.current({ ...latest.current, camera: { ...camera.current } }); };
  const zoom = (value: number, px?: number, py?: number) => {
    const box = root.current!.getBoundingClientRect(), c = camera.current;
    const z = Math.max(.25, Math.min(2, value));
    const x = px ?? box.width / 2, y = py ?? box.height / 2;
    camera.current = { x: x - (x - c.x) * z / c.zoom, y: y - (y - c.y) * z / c.zoom, zoom: z };
    active.current = true; paintCamera();
  };
  const gesture = (e: RPointer, update: (dx: number, dy: number) => void, finish: () => void) => {
    e.preventDefault(); e.stopPropagation(); cleanup.current();
    const x = e.clientX, y = e.clientY;
    let dx = 0, dy = 0, raf = 0;
    const flush = () => { raf = 0; update(dx, dy); };
    const move = (ev: PointerEvent) => { dx = ev.clientX - x; dy = ev.clientY - y; if (!raf) raf = requestAnimationFrame(flush); };
    const end = () => {
      if (raf) cancelAnimationFrame(raf);
      update(dx, dy); finish();
      removeEventListener('pointermove', move); removeEventListener('pointerup', end); removeEventListener('pointercancel', end);
      root.current?.classList.remove('wb-gesturing'); cleanup.current = () => {};
    };
    root.current?.classList.add('wb-gesturing');
    addEventListener('pointermove', move); addEventListener('pointerup', end); addEventListener('pointercancel', end);
    cleanup.current = end;
  };
  useEffect(() => {
    const el = root.current!;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey && (e.target as HTMLElement).closest('.wb-window')) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const box = el.getBoundingClientRect(); zoom(camera.current.zoom * Math.exp(-e.deltaY * .002), e.clientX - box.left, e.clientY - box.top);
      } else { camera.current = { ...camera.current, x: camera.current.x - e.deltaX, y: camera.current.y - e.deltaY }; active.current = true; paintCamera(); }
      clearTimeout(wheelSave.current); wheelSave.current = setTimeout(saveCamera, 160);
    };
    const key = (e: KeyboardEvent) => {
      if (el.closest('[hidden]') || (e.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]')) return;
      if (e.code === 'Space') { space.current = true; if (el.contains(document.activeElement)) e.preventDefault(); }
      if (e.key === 'Escape') setMenu(null);
      if (!(e.ctrlKey || e.metaKey) || !['+', '=', '-', '0'].includes(e.key)) return;
      e.preventDefault();
      if (e.key === '0') { camera.current = { x: 0, y: 0, zoom: 1 }; paintCamera(); }
      else zoom(camera.current.zoom * (e.key === '-' ? 1 / 1.2 : 1.2));
      saveCamera();
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') space.current = false; };
    el.addEventListener('wheel', wheel, { passive: false }); addEventListener('keydown', key); addEventListener('keyup', up);
    return () => { cleanup.current(); clearTimeout(wheelSave.current); el.removeEventListener('wheel', wheel); removeEventListener('keydown', key); removeEventListener('keyup', up); };
  }, []);
  const moveWindow = (e: RPointer, id: string, edge = '') => {
    if (e.button !== 0) return;
    setFront(id);
    const start = latest.current.rects[id] || { x: 24, y: 24, w: 480, h: 360 };
    let draft = { ...start };
    const el = world.current!.querySelector<HTMLElement>(`[data-window="${id}"]`)!;
    gesture(e, (dx, dy) => {
      dx /= camera.current.zoom; dy /= camera.current.zoom;
      draft = { ...start };
      if (!edge) { draft.x += dx; draft.y += dy; }
      if (edge.includes('e')) draft.w = Math.max(280, Math.min(3000, start.w + dx));
      if (edge.includes('s')) draft.h = Math.max(200, Math.min(3000, start.h + dy));
      if (edge.includes('w')) { draft.w = Math.max(280, Math.min(3000, start.w - dx)); draft.x = start.x + start.w - draft.w; }
      if (edge.includes('n')) { draft.h = Math.max(200, Math.min(3000, start.h - dy)); draft.y = start.y + start.h - draft.h; }
      Object.assign(el.style, { left: draft.x + 'px', top: draft.y + 'px', width: draft.w + 'px', height: draft.h + 'px' });
    }, () => change.current({ ...latest.current, rects: { ...latest.current.rects, [id]: draft } }));
  };
  const items: PaletteItem[] = [
    { key: 'notes', title: t('notes'), kind: 'notes', icon: 'note-pencil' },
    { key: 'web', title: t('web'), kind: 'web', icon: 'globe' },
    { key: 'files', title: t('files'), kind: 'files', icon: 'folder' }, ...palette,
  ];
  const add = (item: PaletteItem) => {
    if (!menu) return;
    const child = view(item.kind, item.title, item.icon, item.target);
    const n = latest.current;
    change.current({ ...n, children: [...n.children, child], rects: { ...n.rects, [child.id]: { x: menu.wx, y: menu.wy, w: 560, h: 420 } } });
    setMenu(null); setFront(child.id);
  };
  const maximize = (id: string) => {
    const box = root.current!.getBoundingClientRect(), c = camera.current;
    change.current({ ...latest.current, rects: { ...latest.current.rects, [id]: { x: (8 - c.x) / c.zoom, y: (8 - c.y) / c.zoom, w: (box.width - 16) / c.zoom, h: (box.height - 16) / c.zoom } } });
  };
  return <div className="wb-canvas" ref={root} tabIndex={0} onContextMenu={e => {
    if ((e.target as HTMLElement).closest('.wb-window-body')) return;
    e.preventDefault(); e.stopPropagation(); const box = root.current!.getBoundingClientRect(), c = camera.current;
    setFilter(''); setMenu({ x: e.clientX, y: e.clientY, wx: (e.clientX - box.left - c.x) / c.zoom, wy: (e.clientY - box.top - c.y) / c.zoom });
  }}>
    <div className="wb-canvas-controls" title="Ctrl + / − · Ctrl 0 · Space + drag">
      <Button icon="minus" label={t('scale')} onClick={() => { zoom(camera.current.zoom / 1.2); saveCamera(); }} />
      <span data-zoom>{Math.round(tree.camera.zoom * 100) + '%'}</span>
      <Button icon="plus" label={t('scale')} onClick={() => { zoom(camera.current.zoom * 1.2); saveCamera(); }} />
      <Button icon="crosshair-simple" label={t('resetView')} onClick={() => { camera.current = { x: 0, y: 0, zoom: 1 }; paintCamera(); saveCamera(); }} />
    </div>
    <div className="wb-canvas-pan" onPointerDown={e => {
      if (e.button !== 1 && !space.current && e.target !== e.currentTarget) return;
      const start = { ...camera.current }; active.current = true; root.current?.focus(); setMenu(null);
      gesture(e, (dx, dy) => { camera.current = { ...start, x: start.x + dx, y: start.y + dy }; paintCamera(); }, saveCamera);
    }}>
      <div className="wb-canvas-world" ref={world} style={{ transform: `translate3d(${tree.camera.x}px,${tree.camera.y}px,0) scale(${tree.camera.zoom})` }}>
        {tree.children.map((c, i) => {
          const r: Rect = tree.rects[c.id] || { x: 24, y: 24, w: 480, h: 360 };
          return <div data-window={c.id} key={c.id} className="wb-window" hidden={min.includes(c.id) || (!!c.hidden && !edit)} style={{ left: r.x, top: r.y, width: r.w, height: r.h, zIndex: front === c.id ? 100 : i + 1 }} onPointerDownCapture={() => setFront(c.id)}>
            <header onDoubleClick={() => maximize(c.id)} onPointerDown={e => { if (!(e.target as HTMLElement).closest('button')) moveWindow(e, c.id); }}>
              <WIcon name={c.icon} size={16} /><span className="wb-window-title" onClick={() => edit && onSelect(c.id)}>{c.title}</span>
              <Button icon="minus" label={t('minimize')} onClick={() => setMin([...min, c.id])} />
              <Button icon="corners-out" label={t('maximize')} onClick={() => maximize(c.id)} />
              <Button icon="x" label={t('remove')} onClick={() => { const n = latest.current; const rects = { ...n.rects }; delete rects[c.id]; change.current({ ...n, rects, children: n.children.filter(x => x.id !== c.id) }); }} />
            </header>
            <div className="wb-window-body">{render(c)}</div>
            {['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'].map(edge => <div key={edge} role="separator" aria-label={t('scale') + ' ' + edge} className={'wb-window-edge edge-' + edge} onPointerDown={e => moveWindow(e, c.id, edge)} />)}
          </div>;
        })}
      </div>
    </div>
    {min.length > 0 && <div className="wb-minimized">{tree.children.filter(c => min.includes(c.id)).map(c => <button key={c.id} onClick={() => setMin(min.filter(id => id !== c.id))}><WIcon name={c.icon} />{c.title}</button>)}</div>}
    {!tree.children.length && <div className="wb-empty" style={{ pointerEvents: 'none' }}>{t('noWindows')}</div>}
    {menu && createPortal(<><div className="wb-canvas-menu-backdrop" onPointerDown={() => setMenu(null)} onContextMenu={e => { e.preventDefault(); setMenu(null); }} /><div className="wb-canvas-menu" role="menu" style={{ left: Math.max(8, Math.min(menu.x, innerWidth - 308)), top: Math.max(8, Math.min(menu.y, innerHeight - 380)) }}>
      <input autoFocus placeholder={t('search')} aria-label={t('search')} value={filter} onChange={e => setFilter(e.target.value)} />
      {items.filter(i => i.title.toLowerCase().includes(filter.toLowerCase())).map(i => <button role="menuitem" key={i.key} onClick={() => add(i)}><WIcon name={i.icon} size={16} /><span>{i.title}</span></button>)}
    </div></>, document.body)}
  </div>;
}
