import { useEffect, useRef, useState } from "react";
import { getStickerImage, type DesktopSticker } from "@workspace/api-client-react";
import { clampLayout, clampSize, displayDims, TASKBAR_H, type Layout } from "./stickerLayout";
import type { useStickers } from "./useStickers";

type Ctl = ReturnType<typeof useStickers>;
const F = "Tahoma, sans-serif";

function useStickerImage(id: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [tries, setTries] = useState(0);
  useEffect(() => {
    let live = true;
    let made: string | null = null;
    const ac = new AbortController();
    setUrl(null); setError(false);
    getStickerImage(id, { signal: ac.signal })
      .then(b => { if (!live) return; made = URL.createObjectURL(b); setUrl(made); })
      .catch(() => { if (live) setError(true); });
    return () => { live = false; ac.abort(); if (made) URL.revokeObjectURL(made); };
  }, [id, tries]);
  return { url, error, retry: () => setTries(t => t + 1) };
}

function StickerItem({ s, layout, selected, onSelect, onLayout, onCommit, onRemove, error, onRetry, removeError, onRetryRemove }: {
  s: DesktopSticker; layout: Layout; selected: boolean; onSelect: () => void;
  onLayout: (l: Layout) => void; onCommit: (l: Layout) => void; onRemove: () => void;
  error?: string; onRetry: () => void; removeError?: string; onRetryRemove: () => void;
}) {
  const img = useStickerImage(s.id);
  const { w, h } = displayDims(s.imageWidth, s.imageHeight, layout.size);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const rs = useRef<{ x: number; y: number; size: number } | null>(null);
  const latest = useRef(layout);
  latest.current = layout;
  const fit = (l: Layout) => clampLayout(l, s.imageWidth, s.imageHeight, window.innerWidth, window.innerHeight);

  const down = (e: React.PointerEvent) => {
    onSelect();
    drag.current = { dx: e.clientX - layout.x, dy: e.clientY - layout.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (drag.current) onLayout(fit({ ...latest.current, x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy }));
  };
  const up = () => { if (drag.current) { drag.current = null; onCommit(latest.current); } };

  const rdown = (e: React.PointerEvent) => {
    e.stopPropagation();
    rs.current = { x: e.clientX, y: e.clientY, size: layout.size };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const rmove = (e: React.PointerEvent) => {
    const r = rs.current; if (!r) return;
    const k = Math.max(w, h) / Math.max(1, Math.max(w, h));
    const d = Math.max(e.clientX - r.x, e.clientY - r.y) * k;
    onLayout(fit({ ...latest.current, size: clampSize(r.size + d, window.innerWidth, window.innerHeight) }));
  };
  const rup = () => { if (rs.current) { rs.current = null; onCommit(latest.current); } };

  const key = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    const step = e.shiftKey ? 40 : 10;
    let l: Layout | null = null;
    if (e.key === "ArrowLeft") l = { ...layout, x: layout.x - step };
    else if (e.key === "ArrowRight") l = { ...layout, x: layout.x + step };
    else if (e.key === "ArrowUp") l = { ...layout, y: layout.y - step };
    else if (e.key === "ArrowDown") l = { ...layout, y: layout.y + step };
    else if (e.key === "+" || e.key === "=") l = { ...layout, size: layout.size + 8 };
    else if (e.key === "-" || e.key === "_") l = { ...layout, size: layout.size - 8 };
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); onRemove(); return; }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); return; }
    if (!l) return;
    e.preventDefault();
    onSelect();
    const c = fit(l);
    onLayout(c); onCommit(c);
  };

  const ctl: React.CSSProperties = { position: "absolute", top: -24, right: 0, display: "flex", gap: 2 };
  return (
    <div
      data-testid={`sticker-${s.id}`}
      role="group" tabIndex={0}
      aria-label={`Sticker ${s.name}. Arrow keys move, plus and minus resize, Delete removes.`}
      onKeyDown={key} onFocus={onSelect}
      style={{
        position: "absolute", left: layout.x, top: layout.y, width: w, height: h, pointerEvents: "auto",
        outline: selected ? "1px dashed var(--xp-accent)" : "none", outlineOffset: 2, touchAction: "none",
      }}
    >
      <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        style={{ width: "100%", height: "100%", cursor: "move", touchAction: "none" }}>
        {img.url ? (
          <img src={img.url} alt={s.name} draggable={false} style={{ width: "100%", height: "100%", display: "block", userSelect: "none", pointerEvents: "none" }} />
        ) : img.error ? (
          <button type="button" className="xp-button" onClick={img.retry} onPointerDown={e => e.stopPropagation()} style={{ fontSize: 10, padding: "1px 4px" }} data-testid={`button-retry-image-${s.id}`}>Retry image</button>
        ) : (
          <div aria-busy="true" style={{ width: "100%", height: "100%", border: "1px dotted var(--xp-border-dark)", opacity: 0.5 }} />
        )}
      </div>
      {selected && (
        <>
          <div style={ctl}>
            <button type="button" className="xp-button" aria-label="Remove sticker" onClick={onRemove} data-testid={`button-remove-sticker-${s.id}`} style={{ fontSize: 10, padding: "0 6px", fontFamily: F }}>Remove</button>
          </div>
          <div role="slider" aria-label="Resize sticker" aria-valuemin={24} aria-valuemax={512} aria-valuenow={layout.size}
            onPointerDown={rdown} onPointerMove={rmove} onPointerUp={rup} onPointerCancel={rup}
            data-testid={`handle-resize-sticker-${s.id}`}
            style={{ position: "absolute", right: -7, bottom: -7, width: 14, height: 14, background: "var(--xp-accent)", border: "1px solid var(--xp-border-dark)", cursor: "nwse-resize", touchAction: "none" }} />
        </>
      )}
      {(error || removeError) && (
        <div role="alert" data-testid={`error-sticker-${s.id}`} style={{ position: "absolute", top: h + 10, left: 0, width: 200, maxWidth: "70vw", background: "var(--xp-window-bg)", color: "var(--xp-window-text)", border: "1px solid var(--xp-border-dark)", fontFamily: F, fontSize: 11, padding: 4 }}>
          {removeError && <div>{removeError} <button type="button" className="xp-button" onClick={onRetryRemove} data-testid={`button-retry-remove-${s.id}`} style={{ fontSize: 10, padding: "0 6px" }}>Retry remove</button></div>}
          {error && <div>{error} <button type="button" className="xp-button" onClick={onRetry} data-testid={`button-retry-sticker-${s.id}`} style={{ fontSize: 10, padding: "0 6px" }}>Retry save</button></div>}
        </div>
      )}
    </div>
  );
}

export function DesktopStickers({ ctl, managerOpen, onCloseManager }: { ctl: Ctl; managerOpen: boolean; onCloseManager: () => void }) {
  const { stickers, layouts, previewLayout, saveLayout, retryLayout, remove, layoutErrors, deleteErrors } = ctl;
  const [selected, setSelected] = useState<string | null>(null);
  const [mpos, setMpos] = useState<{ x: number; y: number } | null>(null);
  const mdrag = useRef<{ dx: number; dy: number } | null>(null);
  const mref = useRef<HTMLDivElement>(null);

  const fitL = (s: DesktopSticker, l: Layout) => clampLayout(l, s.imageWidth, s.imageHeight, window.innerWidth, window.innerHeight);
  const layoutOf = (s: DesktopSticker): Layout => fitL(s, layouts[s.id] ?? { x: s.posX, y: s.posY, size: s.displaySize });

  const [, bump] = useState(0);
  useEffect(() => {
    const r = () => { bump(n => n + 1); setMpos(p => (p ? clampWin(p.x, p.y, mref.current) : p)); };
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, []);

  const commit = (s: DesktopSticker, l: Layout) => { saveLayout(s, l); };
  const nudge = (s: DesktopSticker, dx: number, dy: number) => { const l = layoutOf(s); setSelected(s.id); commit(s, { ...l, x: l.x + dx, y: l.y + dy }); };
  const winPos = () => {
    const r = mref.current?.getBoundingClientRect();
    return mpos ?? { x: r ? r.left : Math.max(0, window.innerWidth - 332), y: r ? r.top : 12 };
  };
  const moveWin = (dx: number, dy: number) => { const p = winPos(); setMpos(clampWin(p.x + dx, p.y + dy, mref.current)); };

  return (
    <>
      <div style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none", bottom: TASKBAR_H }}
        onPointerDown={e => { if (e.target === e.currentTarget) setSelected(null); }}>
        {stickers.map(s => (
          <StickerItem key={s.id} s={s} layout={layoutOf(s)} selected={selected === s.id}
            onSelect={() => setSelected(s.id)} onLayout={l => previewLayout(s.id, l)} onCommit={l => commit(s, l)}
            onRemove={() => remove(s.id)} error={layoutErrors[s.id]} onRetry={() => retryLayout(s)}
            removeError={deleteErrors[s.id]} onRetryRemove={() => remove(s.id)} />
        ))}
      </div>
      {managerOpen && (
        <div ref={mref} className="xp-window" role="dialog" aria-label="Stickers" data-testid="window-stickers"
          style={{ position: "fixed", ...(mpos ? { left: mpos.x, top: mpos.y } : { right: 12, top: 12 }), width: "min(340px, calc(100vw - 24px))", maxHeight: `calc(100dvh - ${TASKBAR_H + 24}px)`, zIndex: 1400, display: "flex", flexDirection: "column" }}
          onKeyDown={e => { if (e.key === "Escape") onCloseManager(); }}>
          <div className="xp-titlebar" style={{ cursor: "move", touchAction: "none" }}
            onPointerDown={e => { if ((e.target as HTMLElement).closest("button")) return; const p = winPos(); mdrag.current = { dx: e.clientX - p.x, dy: e.clientY - p.y }; e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerMove={e => { if (mdrag.current) setMpos(clampWin(e.clientX - mdrag.current.dx, e.clientY - mdrag.current.dy, mref.current)); }}
            onPointerUp={() => { mdrag.current = null; }} onPointerCancel={() => { mdrag.current = null; }}>
            <span>Stickers ({stickers.length}/50)</span>
            <div className="xp-titlebar-controls">
              <button type="button" className="xp-btn-control xp-btn-close" aria-label="Close stickers" onClick={onCloseManager} data-testid="button-close-stickers" />
            </div>
          </div>
          <div className="xp-body" style={{ padding: 6, gap: 4, overflowY: "auto", fontFamily: F, fontSize: 12, color: "var(--xp-window-text)" }}>
            <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
              <span style={{ flex: 1 }}>Move this window</span>
              <button type="button" className="xp-button" aria-label="Move window left" onClick={() => moveWin(-40, 0)} data-testid="button-window-left">&lt;</button>
              <button type="button" className="xp-button" aria-label="Move window up" onClick={() => moveWin(0, -40)} data-testid="button-window-up">^</button>
              <button type="button" className="xp-button" aria-label="Move window down" onClick={() => moveWin(0, 40)} data-testid="button-window-down">v</button>
              <button type="button" className="xp-button" aria-label="Move window right" onClick={() => moveWin(40, 0)} data-testid="button-window-right">&gt;</button>
            </div>
            {ctl.isError && (
              <div role="alert">Stickers could not be loaded. <button type="button" className="xp-button" onClick={() => void ctl.refetch()} data-testid="button-retry-stickers">Retry</button></div>
            )}
            {ctl.isLoading && <div aria-busy="true">Loading stickers...</div>}
            {!ctl.isLoading && !ctl.isError && stickers.length === 0 && <div>No stickers yet. Use Start, then Add sticker.</div>}
            {stickers.map(s => {
              const l = layoutOf(s);
              return (
                <div key={s.id} data-testid={`row-sticker-${s.id}`} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 3, borderBottom: "1px solid var(--xp-separator)", paddingBottom: 4 }}>
                  <span style={{ flex: 1, minWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.name}>{s.name} ({l.x}, {l.y})</span>
                  <button type="button" className="xp-button" aria-label={`Move ${s.name} left`} onClick={() => nudge(s, -20, 0)}>&lt;</button>
                  <button type="button" className="xp-button" aria-label={`Move ${s.name} up`} onClick={() => nudge(s, 0, -20)}>^</button>
                  <button type="button" className="xp-button" aria-label={`Move ${s.name} down`} onClick={() => nudge(s, 0, 20)}>v</button>
                  <button type="button" className="xp-button" aria-label={`Move ${s.name} right`} onClick={() => nudge(s, 20, 0)}>&gt;</button>
                  <button type="button" className="xp-button" onClick={() => { setSelected(s.id); commit(s, { ...l, x: 16, y: 40 }); }} data-testid={`button-reveal-sticker-${s.id}`}>Corner</button>
                  <button type="button" className="xp-button" aria-label={`Smaller ${s.name}`} onClick={() => commit(s, { ...l, size: l.size - 16 })}>-</button>
                  <button type="button" className="xp-button" aria-label={`Larger ${s.name}`} onClick={() => commit(s, { ...l, size: l.size + 16 })}>+</button>
                  <button type="button" className="xp-button" onClick={() => remove(s.id)} data-testid={`button-delete-sticker-${s.id}`}>Remove</button>
                  {deleteErrors[s.id] && <div role="alert" style={{ width: "100%" }}>{deleteErrors[s.id]} <button type="button" className="xp-button" onClick={() => remove(s.id)}>Retry remove</button></div>}
                  {layoutErrors[s.id] && <div role="alert" style={{ width: "100%" }}>{layoutErrors[s.id]} <button type="button" className="xp-button" onClick={() => retryLayout(s)}>Retry save</button></div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function clampWin(x: number, y: number, el: HTMLElement | null) {
  const w = el?.offsetWidth ?? 340, h = el?.offsetHeight ?? 200;
  return { x: Math.max(0, Math.min(x, window.innerWidth - w)), y: Math.max(0, Math.min(y, window.innerHeight - TASKBAR_H - h)) };
}

export function StickerUploadStatus({ ctl }: { ctl: Ctl }) {
  const u = ctl.upload;
  if (!u) return null;
  const labels = { compressing: "Optimizing image...", reserving: "Preparing upload...", uploading: "Uploading...", finalizing: "Saving sticker...", error: "" } as const;
  return (
    <div className="xp-window" role="status" aria-live="polite" data-testid="window-sticker-upload"
      style={{ position: "fixed", right: 12, bottom: TASKBAR_H + 12, width: "min(300px, calc(100vw - 24px))", zIndex: 1500 }}>
      <div className="xp-titlebar" style={{ cursor: "default" }}>
        <span>Add sticker</span>
        {u.phase === "error" && (
          <div className="xp-titlebar-controls">
            <button type="button" className="xp-btn-control xp-btn-close" aria-label="Dismiss" onClick={ctl.dismissUpload} data-testid="button-dismiss-upload" />
          </div>
        )}
      </div>
      <div className="xp-body" style={{ padding: 8, gap: 6, fontFamily: F, fontSize: 12, color: "var(--xp-window-text)" }}>
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
        {u.phase === "error" ? (
          <>
            <div role="alert" data-testid="text-upload-error">{u.error}</div>
            <div style={{ display: "flex", gap: 6 }}>
              {u.retryable && <button type="button" className="xp-button" onClick={ctl.retryUpload} data-testid="button-retry-upload">Retry</button>}
              <button type="button" className="xp-button" onClick={ctl.dismissUpload} data-testid="button-cancel-upload">Close</button>
            </div>
          </>
        ) : (
          <>
            <div>{labels[u.phase]}{u.phase === "uploading" ? ` ${Math.round(u.progress * 100)}%` : ""}</div>
            <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(u.progress * 100)} style={{ height: 12, border: "1px solid var(--xp-border-dark)", background: "var(--xp-window-bg)" }}>
              <div style={{ height: "100%", width: u.phase === "uploading" ? `${u.progress * 100}%` : "100%", background: "var(--xp-accent)", opacity: u.phase === "uploading" ? 1 : 0.4 }} />
            </div>
            {u.phase === "uploading" && <button type="button" className="xp-button" onClick={ctl.dismissUpload} data-testid="button-cancel-upload">Cancel</button>}
          </>
        )}
      </div>
    </div>
  );
}
