import React, { useState, useCallback } from "react";
import { setPin, verifyPin, removePin } from "@workspace/api-client-react";

interface Props {
  onClose: () => void;
  onPinChanged: () => void;
  onPinRemoved: () => void;
}

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

const LABEL: React.CSSProperties = {
  fontFamily: "Tahoma, sans-serif",
  fontSize: 12,
  color: "#000",
  marginBottom: 4,
};

const INPUT: React.CSSProperties = {
  fontFamily: "Tahoma, sans-serif",
  fontSize: 12,
  border: "2px inset #888",
  background: "#fff",
  padding: "3px 6px",
  width: 140,
  letterSpacing: "0.25em",
};

type Tab = "change" | "remove";

function TabBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "4px 14px",
        fontFamily: "Tahoma, sans-serif",
        fontSize: 12,
        cursor: "pointer",
        background: active ? "#ece9d8" : "#d4d0c8",
        borderTop: "2px outset #d4d0c8",
        borderLeft: "2px outset #d4d0c8",
        borderRight: "2px outset #d4d0c8",
        borderBottom: active ? "2px solid #ece9d8" : "2px inset #d4d0c8",
        marginBottom: active ? -1 : 0,
        zIndex: active ? 1 : 0,
        position: "relative",
        userSelect: "none",
      }}
    >
      {label}
    </div>
  );
}

export function PinSettingsDialog({ onClose, onPinChanged, onPinRemoved }: Props) {
  const [tab, setTab] = useState<Tab>("change");

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [removeCurrentPin, setRemoveCurrentPin] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [shaking, setShaking] = useState(false);

  const shake = useCallback(() => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  }, []);

  const handleChangePin = async () => {
    setError(null);
    setSuccess(null);
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setError("New PIN must be exactly 4 digits.");
      shake();
      return;
    }
    if (newPin !== confirmNewPin) {
      setError("New PINs do not match.");
      shake();
      setNewPin("");
      setConfirmNewPin("");
      return;
    }
    setLoading(true);
    try {
      const verify = await verifyPin({ pin: currentPin });
      if (!verify.ok) {
        setError("Current PIN is incorrect.");
        shake();
        setCurrentPin("");
        return;
      }
      await setPin({ pin: newPin });
      setSuccess("PIN changed successfully.");
      setCurrentPin("");
      setNewPin("");
      setConfirmNewPin("");
      onPinChanged();
    } catch {
      setError("Failed to change PIN. Try again.");
      shake();
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePin = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const verify = await verifyPin({ pin: removeCurrentPin });
      if (!verify.ok) {
        setError("Incorrect PIN.");
        shake();
        setRemoveCurrentPin("");
        return;
      }
      await removePin();
      setSuccess("PIN removed.");
      onPinRemoved();
    } catch {
      setError("Failed to remove PIN. Try again.");
      shake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 9998,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 320,
          background: "#ece9d8",
          border: "2px outset #d4d0c8",
          boxShadow: "4px 4px 12px rgba(0,0,0,0.5)",
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
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14 }}>🔑</span>
            <span
              style={{
                color: "white",
                fontFamily: "Tahoma, sans-serif",
                fontSize: 12,
                fontWeight: "bold",
                textShadow: "1px 1px rgba(0,0,0,0.5)",
              }}
            >
              Lock Settings
            </span>
          </div>
          <button
            onClick={onClose}
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
        </div>

        <div style={{ padding: "12px 14px 0" }}>
          <div style={{ display: "flex", gap: 4 }}>
            <TabBtn
              label="Change PIN"
              active={tab === "change"}
              onClick={() => { setTab("change"); setError(null); setSuccess(null); }}
            />
            <TabBtn
              label="Remove PIN"
              active={tab === "remove"}
              onClick={() => { setTab("remove"); setError(null); setSuccess(null); }}
            />
          </div>
        </div>

        <div
          style={{
            margin: "0 14px 14px",
            border: "2px inset #d4d0c8",
            padding: "14px",
            background: "#ece9d8",
          }}
        >
          {tab === "change" && (
            <div>
              <div style={{ marginBottom: 10 }}>
                <div style={LABEL}>Current PIN:</div>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={currentPin}
                  onChange={e => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  style={INPUT}
                  placeholder="••••"
                />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={LABEL}>New PIN:</div>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  style={INPUT}
                  placeholder="••••"
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={LABEL}>Confirm New PIN:</div>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={confirmNewPin}
                  onChange={e => setConfirmNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  style={INPUT}
                  placeholder="••••"
                />
              </div>
              {error && (
                <div style={{ color: "#c00", fontFamily: "Tahoma, sans-serif", fontSize: 11, marginBottom: 8 }}>
                  ⚠️ {error}
                </div>
              )}
              {success && (
                <div style={{ color: "#060", fontFamily: "Tahoma, sans-serif", fontSize: 11, marginBottom: 8 }}>
                  ✓ {success}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button onClick={handleChangePin} disabled={loading} style={{ ...XP_BTN, opacity: loading ? 0.6 : 1 }}>
                  Change PIN
                </button>
                <button onClick={onClose} style={XP_BTN}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {tab === "remove" && (
            <div>
              <div
                style={{
                  fontFamily: "Tahoma, sans-serif",
                  fontSize: 12,
                  color: "#600",
                  marginBottom: 12,
                  lineHeight: 1.4,
                }}
              >
                Enter your current PIN to remove the lock from your journal.
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={LABEL}>Current PIN:</div>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={removeCurrentPin}
                  onChange={e => setRemoveCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  style={INPUT}
                  placeholder="••••"
                />
              </div>
              {error && (
                <div style={{ color: "#c00", fontFamily: "Tahoma, sans-serif", fontSize: 11, marginBottom: 8 }}>
                  ⚠️ {error}
                </div>
              )}
              {success && (
                <div style={{ color: "#060", fontFamily: "Tahoma, sans-serif", fontSize: 11, marginBottom: 8 }}>
                  ✓ {success}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  onClick={handleRemovePin}
                  disabled={loading}
                  style={{ ...XP_BTN, color: "#800", opacity: loading ? 0.6 : 1 }}
                >
                  Remove PIN
                </button>
                <button onClick={onClose} style={XP_BTN}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
