import { useCallback, useEffect, useRef, useState } from "react";
import { getAttachmentImage } from "@workspace/api-client-react";
import type { AttItem } from "./bodyModel";
import { formatKB } from "./imageCompress";

const W = 460, H = 420, TASKBAR = 30;

export function ImagePreviewWindow({ items, index, onIndex, onClose }: {
  items: AttItem[]; index: number; onIndex: (i: number) => void; onClose: () => void;
}) {
  const item = items[index];
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [tries, setTries] = useState(0);
  const winRef = useRef<HTMLDivElement>(null);
  const clamp = useCallback((x: number, y: number) => {
    const w = Math.min(W, window.innerWidth), h = Math.min(H, window.innerHeight - TASKBAR);
    return { x: Math.max(0, Math.min(x, window.innerWidth - w)), y: Math.max(0, Math.min(y, window.innerHeight - TASKBAR - h)) };
  }, []);
  const [pos, setPos] = useState(() => clamp(window.innerWidth - W - 40, 70));
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const id = item?.id;

  useEffect(() => {
    if (!id) return;
    let live = true;
    let made: string | null = null;
    const ac = new AbortController();
    setUrl(null); setError(false);
    getAttachmentImage(id, { signal: ac.signal }).then(b => {
      if (!live) return;
      made = URL.createObjectURL(b);
      setUrl(made);
    }).catch(() => { if (live) setError(true); });
    return () => { live = false; ac.abort(); if (made) URL.revokeObjectURL(made); };
  }, [id, tries]);

  useEffect(() => {
    const r = () => setPos(p => clamp(p.x, p.y));
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, [clamp]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    winRef.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);

  if (!item) return null;
  const go = (d: number) => { if (items.length > 1) onIndex((index + d + items.length) % items.length); };
  const step = 20;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    else if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    else if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); go(1); }
    else if (e.key === "PageUp") go(-1);
    else if (e.key === "PageDown") go(1);
    else if (e.shiftKey && e.key.startsWith("Arrow")) {
      e.preventDefault();
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      setPos(p => clamp(p.x + dx, p.y + dy));
    }
  };
  const down = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => { if (drag.current) setPos(clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy)); };
  const up = () => { drag.current = null; };
  const nav: React.CSSProperties = { padding: "2px 10px", fontSize: 12 };

  return (
    <div
      ref={winRef} tabIndex={-1} role="dialog" aria-label={`Image preview: ${item.name}`}
      onKeyDown={onKey} className="xp-window" data-testid="window-image-preview"
      style={{ position: "fixed", left: pos.x, top: pos.y, width: `min(${W}px, 100vw)`, height: `min(${H}px, calc(100dvh - ${TASKBAR}px))`, zIndex: 60, outline: "none" }}
    >
      <div className="xp-titlebar" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ touchAction: "none", cursor: "default" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>Preview &mdash; {item.name}</span>
        <div className="xp-titlebar-controls">
          <button type="button" className="xp-btn-control xp-btn-close" aria-label="Close preview" onClick={onClose} data-testid="button-close-preview" />
        </div>
      </div>
      <div className="xp-body" style={{ flex: 1, minHeight: 0, padding: 6, gap: 6 }}>
        <div className="xp-inset" style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: 4 }}>
          {error ? (
            <div style={{ textAlign: "center", fontFamily: "Tahoma, sans-serif", fontSize: 12 }} role="alert">
              <p style={{ marginBottom: 8 }}>This image could not be loaded.</p>
              <button type="button" className="xp-button" onClick={() => setTries(t => t + 1)} data-testid="button-retry-preview">Retry</button>
            </div>
          ) : !url ? (
            <div style={{ fontFamily: "Tahoma, sans-serif", fontSize: 12 }} aria-busy="true">Loading image...</div>
          ) : (
            <img src={url} alt={item.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }} />
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "Tahoma, sans-serif", fontSize: 11, color: "var(--xp-window-text)" }}>
          <button type="button" className="xp-button" style={nav} disabled={items.length < 2} onClick={() => go(-1)} aria-label="Previous image">Prev</button>
          <button type="button" className="xp-button" style={nav} disabled={items.length < 2} onClick={() => go(1)} aria-label="Next image">Next</button>
          <span style={{ flex: 1, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.name} &middot; {formatKB(item.size)} &middot; {index + 1} of {items.length}
          </span>
        </div>
      </div>
    </div>
  );
}
