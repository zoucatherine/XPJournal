import { useEffect, useRef } from "react";
import type { Caret, Doc } from "./bodyModel";
import { CAPTION_LIMIT } from "./bodyModel";
import { formatKB } from "./imageCompress";

function Seg({ value, first, disabled, onChange, onCaret, onEdge, refCb }: {
  value: string; first: boolean; disabled: boolean;
  onChange: (v: string) => void; onCaret: (pos: number) => void;
  onEdge: (dir: -1 | 1) => void; refCb: (el: HTMLTextAreaElement | null) => void;
}) {
  const el = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const t = el.current;
    if (t) { t.style.height = "auto"; t.style.height = `${Math.max(t.scrollHeight, first ? 60 : 30)}px`; }
  }, [value, first]);
  const rec = (e: { currentTarget: HTMLTextAreaElement }) => onCaret(e.currentTarget.selectionStart);
  return (
    <textarea
      ref={n => { el.current = n; refCb(n); }}
      value={value}
      disabled={disabled}
      rows={1}
      onChange={e => { onChange(e.target.value); onCaret(e.target.selectionStart); }}
      onSelect={rec} onKeyUp={rec} onClick={rec} onBlur={rec} onFocus={rec}
      onKeyDown={e => {
        const t = e.currentTarget;
        if (t.selectionStart !== t.selectionEnd || e.shiftKey) return;
        if ((e.key === "ArrowUp" || e.key === "ArrowLeft") && t.selectionStart === 0) { e.preventDefault(); onEdge(-1); }
        if ((e.key === "ArrowDown" || e.key === "ArrowRight") && t.selectionStart === t.value.length) { e.preventDefault(); onEdge(1); }
      }}
      className="xp-textarea w-full"
      placeholder={first ? "Dear diary..." : undefined}
      aria-label={first ? "Entry text" : "Entry text continued"}
      style={{ display: "block", background: "transparent", color: "var(--xp-calendar-text)", border: "none", overflow: "hidden", minHeight: 30 }}
    />
  );
}

export function BodyEditor({ doc, disabled, caretRef, onText, onCaption, onPreview, onReplace, onRemove }: {
  doc: Doc; disabled: boolean; caretRef: { current: Caret };
  onText: (i: number, v: string) => void;
  onCaption: (i: number, v: string) => void;
  onPreview: (id: string) => void; onReplace: (i: number) => void; onRemove: (i: number) => void;
}) {
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const focusSeg = (i: number, end: boolean) => {
    const t = refs.current[i];
    if (!t) return;
    t.focus();
    const p = end ? t.value.length : 0;
    t.setSelectionRange(p, p);
  };
  const btn: React.CSSProperties = { padding: "1px 8px", fontSize: 12 };
  return (
    <div className="xp-inset" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 2 }} data-testid="body-editor">
      {doc.texts.map((t, i) => (
        <div key={i}>
          <Seg
            value={t} first={i === 0 && doc.imgs.length === 0} disabled={disabled}
            onChange={v => onText(i, v)}
            onCaret={pos => { caretRef.current = { seg: i, pos }; }}
            onEdge={dir => { const n = i + dir; if (n >= 0 && n < doc.texts.length) focusSeg(n, dir === -1); }}
            refCb={n => { refs.current[i] = n; }}
          />
          {i < doc.imgs.length && (
            <div
              role="group" aria-label={`Attached image ${doc.imgs[i].name}`}
              style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", margin: "2px 4px", padding: "3px 6px", background: "var(--xp-window-bg)", border: "2px outset var(--xp-border-light)", borderRightColor: "var(--xp-border-dark)", borderBottomColor: "var(--xp-border-dark)", fontFamily: "Tahoma, sans-serif", fontSize: 12, color: "var(--xp-window-text)" }}
            >
              <button type="button" className="xp-button" style={{ ...btn, fontWeight: "bold", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                onClick={() => onPreview(doc.imgs[i].id)} title="Open in preview window" data-testid={`button-open-image-${i}`}>
                Open attachment — {doc.imgs[i].caption?.trim() || doc.imgs[i].name}
              </button>
              <span style={{ opacity: 0.75 }}>{formatKB(doc.imgs[i].size)}</span>
              <span style={{ flex: 1 }} />
              <button type="button" className="xp-button" style={btn} disabled={disabled} onClick={() => onReplace(i)} data-testid={`button-replace-image-${i}`}>Replace</button>
              <button type="button" className="xp-button" style={btn} disabled={disabled} onClick={() => onRemove(i)} data-testid={`button-remove-image-${i}`}>Remove</button>
              <label style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", flexWrap: "wrap" }}>
                Caption (optional)
                <input
                  type="text" className="xp-input" value={doc.imgs[i].caption ?? ""}
                  disabled={disabled} maxLength={CAPTION_LIMIT}
                  onChange={e => onCaption(i, e.target.value)}
                  aria-label={`Caption for ${doc.imgs[i].name}`}
                  placeholder="Photo from today’s walk"
                  data-testid={`input-image-caption-${i}`}
                  style={{ flex: 1, minWidth: 100, fontSize: 12 }}
                />
                <span style={{ opacity: 0.75 }}>{(doc.imgs[i].caption ?? "").length}/{CAPTION_LIMIT}</span>
              </label>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
