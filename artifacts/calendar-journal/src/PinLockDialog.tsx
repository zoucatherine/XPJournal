import React, { useState, useEffect, useRef, useCallback } from "react";
import { setPin, verifyPin } from "@workspace/api-client-react";

interface Props {
  mode: "setup" | "unlock";
  onSuccess: () => void;
  onCancel?: () => void;
}

const DOT_STYLE: React.CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: "50%",
  border: "2px inset #888",
  background: "#ccc",
  display: "inline-block",
  margin: "0 5px",
};

const DOT_FILLED: React.CSSProperties = {
  ...DOT_STYLE,
  background: "#003",
  border: "2px inset #001",
};

const XP_BTN: React.CSSProperties = {
  minWidth: 75,
  padding: "3px 10px",
  fontFamily: "Tahoma, sans-serif",
  fontSize: 12,
  cursor: "pointer",
  border: "2px outset #d4d0c8",
  background: "#ece9d8",
  color: "#000",
};

function PinInput({
  label,
  value,
  onChange,
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputRef?: React.RefObject<HTMLInputElement>;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontFamily: "Tahoma, sans-serif",
          fontSize: 12,
          marginBottom: 4,
          color: "#000",
        }}
      >
        {label}
      </div>
      <div
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          background: "#fff",
          border: "2px inset #888",
          padding: "4px 8px",
          width: 130,
          cursor: "text",
          boxSizing: "border-box",
        }}
        onClick={() => inputRef?.current?.focus()}
      >
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={i < value.length ? DOT_FILLED : DOT_STYLE} />
        ))}
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={value}
          autoComplete="off"
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 4);
            onChange(v);
          }}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: 0.01,
            cursor: "text",
            border: "none",
            background: "transparent",
            outline: "none",
            zIndex: 1,
          }}
        />
      </div>
    </div>
  );
}

export function PinLockDialog({ mode, onSuccess, onCancel }: Props) {
  const [pin, setPin1] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const confirmInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    hiddenInputRef.current?.focus();
  }, []);

  const shake = useCallback(() => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSubmit();
      if (e.key === "Escape" && onCancel) onCancel();
    },
    [pin, confirmPin, mode]
  );

  const handleSubmit = async () => {
    if (pin.length !== 4) {
      setError("Please enter a 4-digit PIN.");
      shake();
      return;
    }

    if (mode === "setup") {
      if (confirmPin.length !== 4) {
        setError("Please confirm your PIN.");
        shake();
        return;
      }
      if (pin !== confirmPin) {
        setError("PINs do not match. Try again.");
        shake();
        setPin1("");
        setConfirmPin("");
        hiddenInputRef.current?.focus();
        return;
      }
      setLoading(true);
      try {
        await setPin({ pin });
        onSuccess();
      } catch {
        setError("Failed to save PIN. Try again.");
        shake();
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(true);
      try {
        const result = await verifyPin({ pin });
        if (result.ok) {
          onSuccess();
        } else {
          setError("Incorrect PIN. Please try again.");
          shake();
          setPin1("");
          hiddenInputRef.current?.focus();
        }
      } catch {
        setError("Could not verify PIN. Try again.");
        shake();
      } finally {
        setLoading(false);
      }
    }
  };

  const title = mode === "setup" ? "Set Up Journal Lock" : "Journal Lock";
  const icon = "🔒";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={containerRef}
        style={{
          width: 320,
          background: "#ece9d8",
          border: "2px outset #d4d0c8",
          boxShadow: "4px 4px 12px rgba(0,0,0,0.6)",
          animation: shaking ? "xp-shake 0.5s" : undefined,
        }}
      >
        <style>{`
          @keyframes xp-shake {
            0%,100% { transform: translateX(0); }
            15% { transform: translateX(-8px); }
            30% { transform: translateX(8px); }
            45% { transform: translateX(-6px); }
            60% { transform: translateX(6px); }
            75% { transform: translateX(-3px); }
            90% { transform: translateX(3px); }
          }
        `}</style>

        <div
          style={{
            background: "linear-gradient(to right, #0a246a, #3a6ea5)",
            padding: "4px 6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            userSelect: "none",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 14 }}>{icon}</span>
            <span
              style={{
                color: "white",
                fontFamily: "Tahoma, sans-serif",
                fontSize: 12,
                fontWeight: "bold",
                textShadow: "1px 1px rgba(0,0,0,0.5)",
              }}
            >
              {title}
            </span>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              title="Cancel"
              style={{
                background: "linear-gradient(to bottom, #e27878, #c04040)",
                border: "1px outset #e88",
                color: "white",
                fontFamily: "Tahoma, sans-serif",
                fontSize: 11,
                fontWeight: "bold",
                cursor: "pointer",
                width: 21,
                height: 21,
                lineHeight: "19px",
                textAlign: "center",
                padding: 0,
              }}
            >
              ✕
            </button>
          )}
        </div>

        <div style={{ padding: "16px 18px 12px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 36, lineHeight: 1, flexShrink: 0 }}>
              🔐
            </span>
            <div
              style={{
                fontFamily: "Tahoma, sans-serif",
                fontSize: 12,
                color: "#000",
                lineHeight: 1.4,
              }}
            >
              {mode === "setup"
                ? "Choose a 4-digit PIN to protect your journal. You will need to enter it each time you open the app."
                : "Enter your 4-digit PIN to access your journal."}
            </div>
          </div>

          <PinInput
            label={mode === "setup" ? "New PIN:" : "PIN:"}
            value={pin}
            onChange={(v) => {
              setPin1(v);
              setError(null);
              if (mode === "setup" && v.length === 4) {
                setTimeout(() => confirmInputRef.current?.focus(), 50);
              }
            }}
            inputRef={hiddenInputRef}
          />

          {mode === "setup" && (
            <PinInput
              label="Confirm PIN:"
              value={confirmPin}
              onChange={(v) => {
                setConfirmPin(v);
                setError(null);
              }}
              inputRef={confirmInputRef}
            />
          )}

          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "#fff0f0",
                border: "1px solid #c00",
                padding: "4px 8px",
                marginBottom: 10,
                fontFamily: "Tahoma, sans-serif",
                fontSize: 11,
                color: "#c00",
              }}
            >
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 12,
              borderTop: "1px solid #aaa",
              paddingTop: 10,
            }}
          >
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                ...XP_BTN,
                opacity: loading ? 0.6 : 1,
              }}
            >
              {mode === "setup" ? "Set PIN" : "OK"}
            </button>
            {onCancel && (
              <button onClick={onCancel} style={XP_BTN}>
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
