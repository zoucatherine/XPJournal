import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  getListStickersQueryKey,
  useListStickers,
  requestStickerUpload,
  finalizeSticker,
  updateSticker,
  deleteSticker,
  type DesktopSticker,
} from "@workspace/api-client-react";
import { getStoredToken } from "./useAuth";
import { compressSticker, StickerError, type StickerFile } from "./stickerCompress";
import { clampLayout, type Layout } from "./stickerLayout";
import { LatestWins } from "./stickerQueue";

export type UploadPhase = "compressing" | "reserving" | "uploading" | "finalizing" | "error";
export interface UploadState { phase: UploadPhase; name: string; progress: number; error?: string; retryable?: boolean }

function describe(e: unknown, what: string): string {
  if (e instanceof StickerError) return e.message;
  if (e instanceof ApiError) {
    if (e.status === 503) return "Sticker storage is unavailable right now. Try again in a moment.";
    if (e.status === 413 || e.status === 409 || e.status === 422 || e.status === 400) {
      const msg = typeof (e.data as { error?: unknown } | null)?.error === "string" ? (e.data as { error: string }).error : "";
      return msg || `${what} was rejected (limit is 50 stickers and 25 MB).`;
    }
    if (e.status === 401) return "Your session expired. Sign in again.";
  }
  return `${what} failed. Check your connection and try again.`;
}

function putBlob(url: string, blob: Blob, onProgress: (p: number) => void, run: Run): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", "image/png");
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.onabort = () => reject(new Error("aborted"));
    run.abort = () => xhr.abort();
    xhr.send(blob);
  });
}

interface Run { cancelled: boolean; scope: string; token: string | null; reservation: string | null; abort: (() => void) | null }
const authOf = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });
const same = (a: Layout, b: Layout) => a.x === b.x && a.y === b.y && a.size === b.size;
const without = <V,>(m: Record<string, V>, id: string) => { const { [id]: _, ...rest } = m; return rest; };

interface Saver { q: LatestWins<Layout>; timer: ReturnType<typeof setTimeout> | null }

export function useStickers(scope: string) {
  const qc = useQueryClient();
  const key = getListStickersQueryKey();
  const list = useListStickers({ query: { queryKey: key, staleTime: 30_000, refetchOnMount: true } });

  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const current = useCallback((s: string) => alive.current && scopeRef.current === s, []);

  const [upload, setUpload] = useState<UploadState | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Layout>>({});
  const [layoutErrors, setLayoutErrors] = useState<Record<string, string>>({});
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});
  const overridesRef = useRef<Record<string, Layout>>({});
  const prepared = useRef<StickerFile | null>(null);
  const activeRun = useRef<Run | null>(null);
  const savers = useRef<Record<string, Saver>>({});

  const setCache = useCallback((s: string, fn: (prev: DesktopSticker[]) => DesktopSticker[]) => {
    if (!current(s)) return;
    qc.setQueryData<DesktopSticker[]>(key, prev => fn(prev ?? []));
  }, [qc, key, current]);

  const cleanup = useCallback((run: Run, id: string) => {
    if (run.token) deleteSticker(id, authOf(run.token)).catch(() => {});
  }, []);
  const cancelRun = useCallback((run: Run | null) => {
    if (!run) return;
    run.cancelled = true;
    run.abort?.();
    if (run.reservation) { const id = run.reservation; run.reservation = null; cleanup(run, id); }
  }, [cleanup]);

  const stopSavers = useCallback(() => {
    Object.values(savers.current).forEach(s => { if (s.timer) clearTimeout(s.timer); s.q.cancel(); });
    savers.current = {};
  }, []);

  // Account change / unmount: cancel everything in flight and drop local state.
  useEffect(() => () => {
    cancelRun(activeRun.current);
    activeRun.current = null;
    stopSavers();
  }, [scope, cancelRun, stopSavers]);

  const runUpload = useCallback(async (sf: StickerFile, run: Run) => {
    const dead = () => run.cancelled || !current(run.scope);
    const setU = (u: UploadState | null) => { if (activeRun.current === run && alive.current) setUpload(u); };
    const releaseOwn = () => { if (run.reservation) { const id = run.reservation; run.reservation = null; cleanup(run, id); } };
    if (!run.token) { setU({ phase: "error", name: sf.name, progress: 0, error: "Your session expired. Sign in again." }); return; }
    const hdr = authOf(run.token);
    try {
      setU({ phase: "reserving", name: sf.name, progress: 0 });
      const res = await requestStickerUpload({ name: sf.name, size: sf.blob.size }, hdr);
      if (dead()) { cleanup(run, res.id); return; }
      run.reservation = res.id;
      setU({ phase: "uploading", name: sf.name, progress: 0 });
      await putBlob(res.uploadURL, sf.blob, p => { if (!dead()) setU({ phase: "uploading", name: sf.name, progress: p }); }, run);
      if (dead()) { releaseOwn(); return; }
      setU({ phase: "finalizing", name: sf.name, progress: 1 });
      const saved = await finalizeSticker(res.id, hdr);
      run.reservation = null;
      if (dead()) { cleanup(run, saved.id); return; }
      setCache(run.scope, prev => [...prev.filter(x => x.id !== saved.id), saved]);
      if (activeRun.current === run) { prepared.current = null; setUpload(null); }
    } catch (e) {
      releaseOwn();
      if (dead() || (e instanceof Error && e.message === "aborted")) return;
      setU({ phase: "error", name: sf.name, progress: 0, retryable: true, error: e instanceof ApiError ? describe(e, "Upload") : "Upload failed. Check your connection and try again." });
    }
  }, [current, setCache, cleanup]);

  const newRun = useCallback((): Run => {
    cancelRun(activeRun.current);
    const run: Run = { cancelled: false, scope: scopeRef.current, token: getStoredToken(), reservation: null, abort: null };
    activeRun.current = run;
    return run;
  }, [cancelRun]);

  const addFile = useCallback(async (file: File) => {
    const run = newRun();
    prepared.current = null;
    setUpload({ phase: "compressing", name: file.name, progress: 0 });
    try {
      const sf = await compressSticker(file);
      if (run.cancelled || !current(run.scope)) return;
      prepared.current = sf;
      await runUpload(sf, run);
    } catch (e) {
      if (run.cancelled || !current(run.scope) || activeRun.current !== run) return;
      setUpload({ phase: "error", name: file.name, progress: 0, retryable: false, error: describe(e, "Preparing the image") });
    }
  }, [runUpload, current, newRun]);

  const retryUpload = useCallback(() => {
    const sf = prepared.current;
    if (!sf) return;
    void runUpload(sf, newRun());
  }, [runUpload, newRun]);

  const dismissUpload = useCallback(() => {
    cancelRun(activeRun.current);
    activeRun.current = null;
    prepared.current = null;
    setUpload(null);
  }, [cancelRun]);

  const putOverride = useCallback((id: string, l: Layout | null) => {
    const next = l ? { ...overridesRef.current, [id]: l } : without(overridesRef.current, id);
    overridesRef.current = next;
    setOverrides(next);
  }, []);

  const previewLayout = useCallback((id: string, l: Layout) => putOverride(id, l), [putOverride]);

  const saverFor = useCallback((id: string): Saver => {
    let s = savers.current[id];
    if (s) return s;
    const sc = scopeRef.current;
    const token = getStoredToken();
    const q = new LatestWins<Layout>(
      l => {
        if (!token) return Promise.reject(new Error("no session"));
        return updateSticker(id, { posX: l.x, posY: l.y, displaySize: l.size }, authOf(token));
      },
      same,
      (sent, saved, isLatest) => {
        if (!current(sc)) return;
        if (!isLatest) return;
        setCache(sc, prev => prev.map(x => (x.id === id ? (saved as DesktopSticker) : x)));
        const o = overridesRef.current[id];
        if (o && same(o, sent)) putOverride(id, null);
        setLayoutErrors(m => without(m, id));
      },
      (_sent, e, isLatest) => {
        if (current(sc) && isLatest) setLayoutErrors(m => ({ ...m, [id]: describe(e, "Saving the sticker position") }));
      },
    );
    s = { q, timer: null };
    savers.current[id] = s;
    return s;
  }, [current, setCache, putOverride]);

  const saveLayout = useCallback((sticker: DesktopSticker, l: Layout) => {
    const c = clampLayout(l, sticker.imageWidth, sticker.imageHeight, window.innerWidth, window.innerHeight);
    putOverride(sticker.id, c);
    const s = saverFor(sticker.id);
    if (s.timer) clearTimeout(s.timer);
    s.timer = setTimeout(() => { s.timer = null; s.q.set(overridesRef.current[sticker.id] ?? c); }, 350);
    return c;
  }, [saverFor, putOverride]);

  const retryLayout = useCallback((sticker: DesktopSticker) => {
    const o = overridesRef.current[sticker.id];
    if (!o) return;
    setLayoutErrors(m => without(m, sticker.id));
    const s = saverFor(sticker.id);
    if (s.timer) { clearTimeout(s.timer); s.timer = null; }
    s.q.set(o);
  }, [saverFor]);

  const remove = useCallback((id: string) => {
    const sc = scopeRef.current;
    const token = getStoredToken();
    const s = savers.current[id];
    if (s) { if (s.timer) clearTimeout(s.timer); s.q.cancel(); delete savers.current[id]; }
    if (!token) { setDeleteErrors(m => ({ ...m, [id]: "Your session expired. Sign in again." })); return; }
    setDeleteErrors(m => without(m, id));
    deleteSticker(id, authOf(token))
      .then(() => {
        if (!current(sc)) return;
        setCache(sc, prev => prev.filter(x => x.id !== id));
        putOverride(id, null);
        setDeleteErrors(m => without(m, id));
        setLayoutErrors(m => without(m, id));
      })
      .catch(e => { if (current(sc)) setDeleteErrors(m => ({ ...m, [id]: describe(e, "Removing the sticker") })); });
  }, [current, setCache, putOverride]);

  return {
    stickers: list.data ?? [],
    isLoading: list.isLoading,
    isError: list.isError,
    refetch: list.refetch,
    upload, addFile, retryUpload, dismissUpload,
    layouts: overrides, previewLayout, saveLayout, retryLayout,
    remove, layoutErrors, deleteErrors,
  };
}
