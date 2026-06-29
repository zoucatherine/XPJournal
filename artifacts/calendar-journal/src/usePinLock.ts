import { useState, useEffect, useRef, useCallback } from "react";
import { getPinStatus } from "@workspace/api-client-react";

export type PinLockPhase = "loading" | "setup" | "locked" | "unlocked";

export type PinLockState = { phase: PinLockPhase };

const IDLE_TIMEOUT_MS = 30_000;

export function usePinLock() {
  const [state, setState] = useState<PinLockState>({ phase: "loading" });
  const pinConfigured = useRef(false);
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    getPinStatus()
      .then(({ configured }) => {
        pinConfigured.current = configured;
        setState({ phase: configured ? "locked" : "unlocked" });
      })
      .catch(() => {
        setState({ phase: "locked" });
      });
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        hiddenAt.current = Date.now();
      } else {
        const wasHiddenAt = hiddenAt.current;
        hiddenAt.current = null;
        if (wasHiddenAt === null) return;
        const elapsed = Date.now() - wasHiddenAt;
        if (elapsed >= IDLE_TIMEOUT_MS && pinConfigured.current) {
          setState(prev =>
            prev.phase === "unlocked" ? { phase: "locked" } : prev
          );
        }
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const onPinConfigured = useCallback(() => {
    pinConfigured.current = true;
    setState({ phase: "unlocked" });
  }, []);

  const onUnlocked = useCallback(() => {
    setState({ phase: "unlocked" });
  }, []);

  const lock = useCallback(() => {
    setState({ phase: "locked" });
  }, []);

  const onPinRemoved = useCallback(() => {
    pinConfigured.current = false;
    setState({ phase: "unlocked" });
  }, []);

  return { state, onPinConfigured, onUnlocked, lock, onPinRemoved };
}
