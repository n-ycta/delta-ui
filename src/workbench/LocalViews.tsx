import { useEffect, useRef, useState } from "react";
import { WIcon } from "./Icon";
import { t } from "./strings";
import type { Tree } from "./model";
export function Notes({ id }: { id: string }) {
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem("delta.note." + id) || "";
    } catch {
      return "";
    }
  });
  const [error, setError] = useState(false);
  return (
    <div className="wb-notes">
      <textarea
        aria-label={t("notes")}
        placeholder={t("notesHint")}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            localStorage.setItem("delta.note." + id, e.target.value);
            setError(false);
          } catch {
            setError(true);
          }
        }}
      />
      {error && <p role="alert">{t("storageError")}</p>}
    </div>
  );
}
interface StoredFile {
  id: string;
  name: string;
  file: Blob;
  type: string;
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("delta.workbench.media", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("files", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function mediaStore(
  op: "list" | "put" | "delete",
  item?: StoredFile | string,
): Promise<StoredFile[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(
        "files",
        op === "list" ? "readonly" : "readwrite",
      );
      const store = tx.objectStore("files");
      let result: StoredFile[] = [];
      const req =
        op === "list"
          ? store.getAll()
          : op === "put"
            ? store.put(item)
            : store.delete(item as string);
      req.onsuccess = () => {
        if (op === "list") result = req.result as StoredFile[];
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export function LocalMedia() {
  const [files, setFiles] = useState<StoredFile[]>([]),
    [current, setCurrent] = useState(""),
    [src, setSrc] = useState(""),
    [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null),
    media = useRef<HTMLVideoElement>(null);
  const active = files.find((f) => f.id === current);
  const load = () =>
    mediaStore("list")
      .then(setFiles)
      .catch((e) => setError(String(e)));
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!active) {
      setSrc("");
      return;
    }
    const url = URL.createObjectURL(active.file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [active]);
  return (
    <div className="wb-localmedia">
      <div className="wb-view-actions">
        <h3>{t("files")}</h3>
        <button title={t("import")} aria-label={t("import")} onClick={() => input.current?.click()}>
          <WIcon name="upload-simple" />
        </button>
      </div>
      <input
        ref={input}
        type="file"
        hidden
        multiple
        accept="audio/*,video/*"
        onChange={async (e) => {
          try {
            for (const file of Array.from(e.target.files || [])) {
              if (!/^(audio|video)\//.test(file.type))
                throw Error("Unsupported media type");
              await mediaStore("put", {
                id: crypto.randomUUID(),
                name: file.name,
                type: file.type,
                file,
              });
            }
            await load();
          } catch (e) {
            setError(String(e));
          }
          e.target.value = "";
        }}
      />
      {error && (
        <p role="alert" className="wb-warning">
          {error}
        </p>
      )}
      {active && (
        <video
          key={active.id}
          ref={media}
          src={src}
          controls
          playsInline
          preload="metadata"
          className={active.type.startsWith("audio/") ? "wb-audio" : "wb-video"}
          onLoadedMetadata={() => {
            try {
              const time = Number(
                localStorage.getItem("delta.progress." + active.id),
              );
              if (
                Number.isFinite(time) &&
                time > 0 &&
                time < media.current!.duration
              )
                media.current!.currentTime = time;
            } catch {}
          }}
          onTimeUpdate={() => {
            try {
              localStorage.setItem(
                "delta.progress." + active.id,
                String(media.current?.currentTime || 0),
              );
            } catch {}
          }}
          onError={() => setError(t("codecError"))}
        />
      )}
      {!files.length ? (
        <div className="wb-empty">
          <WIcon name="music-notes" size={36} />
          <p>{t("mediaHint")}</p>
        </div>
      ) : (
        <div className="wb-file-list">
          {files.map((f) => (
            <div key={f.id} className={f.id === current ? "selected" : ""}>
              <button className="wb-file" onClick={() => setCurrent(f.id)}>
                <WIcon
                  name={
                    f.type.startsWith("video/") ? "film-strip" : "music-note"
                  }
                />
                <span>{f.name}</span>
              </button>
              <button
                title={t("remove")}
                aria-label={t("remove")}
                onClick={async () => {
                  await mediaStore("delete", f.id);
                  if (f.id === current) setCurrent("");
                  void load();
                }}
              >
                <WIcon name="trash" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export function WebView({ id }: { id: string }) {
  const key = "delta.web." + id;
  const initial=()=>{try{return localStorage.getItem(key)||'';}catch{return '';}};
  const [history,setHistory]=useState<string[]>(()=>[initial()]),[index,setIndex]=useState(0),
    [draft,setDraft]=useState(initial),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  const url=history[index]||'';
  const go=(next:string)=>{setHistory([...history.slice(0,index+1),next]);setIndex(index+1);setDraft(next);localStorage.setItem(key,next);};
  const move=(step:number)=>{const next=index+step;if(next<0||next>=history.length)return;setIndex(next);setDraft(history[next]);localStorage.setItem(key,history[next]);};
  return <div className="wb-web">
    <form onSubmit={e=>{e.preventDefault();try{
      const text=draft.trim();if(!text)return;
      const address=/^https:\/\//i.test(text)?text:/^[\w.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(text)?'https://'+text:'https://www.google.com/search?igu=1&q='+encodeURIComponent(text);
      const u=new URL(address);if(u.protocol!=='https:'||u.username||u.password)throw Error(t('httpsOnly'));
      go(u.href);setError('');
    }catch{setError(t('httpsOnly'));}}}>
      <button type="button" disabled={index===0} onClick={()=>move(-1)} aria-label={t('browserBack')} title={t('browserBack')}><WIcon name="arrow-left"/></button>
      <button type="button" disabled={index>=history.length-1} onClick={()=>move(1)} aria-label={t('browserForward')} title={t('browserForward')}><WIcon name="arrow-right"/></button>
      <button type="button" disabled={!url} onClick={()=>setRevision(v=>v+1)} aria-label={t('browserReload')} title={t('browserReload')}><WIcon name="arrow-clockwise"/></button>
      <input type="text" value={draft} placeholder={t('search')+' / https://'} aria-label={t('url')} onChange={e=>setDraft(e.target.value)}/>
      <button aria-label={t('open')} title={t('open')}><WIcon name="arrow-right"/></button>
      {url&&<a href={url} target="_blank" rel="noopener noreferrer" title={t('browserExternal')} aria-label={t('browserExternal')}><WIcon name="arrow-square-out"/></a>}
    </form>
    <p className="wb-hint" role={error?'alert':undefined}>{error||t('webHint')}</p>
    {url&&<iframe key={revision} src={url} title={t('web')} referrerPolicy="no-referrer" sandbox="allow-scripts allow-forms"/>}
  </div>;
}

export function OfflineView({
  node,
  onAdd,
}: {
  node: Tree;
  onAdd: (kind: "notes" | "files" | "web") => void;
}) {
  return (
    <div className="wb-offline">
      <div className="wb-heading">
        <span className="wb-eyebrow">
          {"DELTA / "}
          {t("device")}
        </span>
        <h1>{node.title}</h1>
      </div>
      <div className="wb-status-card">
        <div className="wb-icon-box">
          <WIcon name="plugs" size={26} />
        </div>
        <div>
          <h3>{t("local")}</h3>
          <p>{t("unavailable")}</p>
        </div>
      </div>
      <div className="wb-quick-grid">
        {(["notes", "files", "web"] as const).map((kind, i) => (
          <button key={kind} className="wb-launch" onClick={() => onAdd(kind)}>
            <WIcon
              name={["note-pencil", "play-circle", "globe"][i]}
              size={28}
            />
            <span>{t(kind)}</span>
            <WIcon name="arrow-up-right" size={18} />
          </button>
        ))}
      </div>
    </div>
  );
}
