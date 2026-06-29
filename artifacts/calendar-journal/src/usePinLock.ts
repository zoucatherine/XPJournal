import { useState, useEffect, useCallback } from "react";
import { getPinStatus } from "@workspace/api-client-react";

export type PinLockPhase = "loading" | "setup" | "locked" | "unlocked";

export type PinLockState = { phase: PinLockPhase };

export function usePinLock() {
  const [state, setState] = useState<PinLockState>({ phase: "loading" });

  useEffect(() => {
    getPinStatus()
      .then(({ configured }) => {
        setState({ phase: configured ? "locked" : "unlocked" });
      })
      .catch(() => {
        setState({ phase: "locked" });
      });
  }, []);

  const onPinConfigured = useCallback(() => {
    setState({ phase: "unlocked" });
  }, []);

  const onUnlocked = useCallback(() => {
    setState({ phase: "unlocked" });
  }, []);

  const lock = useCallback(() => {
    setState({ phase: "locked" });
  }, []);

  const onPinRemoved = useCallback(() => {
    setState({ phase: "unlocked" });
  }, []);

  return { state, onPinConfigured, onUnlocked, lock, onPinRemoved };
}
