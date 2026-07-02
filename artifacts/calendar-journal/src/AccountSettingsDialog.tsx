import React, { useState } from "react";
import { changeUsername, changePassword, ApiError } from "@workspace/api-client-react";

interface Props {
  username: string;
  onClose: () => void;
  onUsernameChanged: (username: string) => void;
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
  width: 200,
};

type Tab = "username" | "password";

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

function extractError(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status !== 500) {
    const data = err.data as { error?: string } | null;
    if (data?.error) return data.error;
  }
  return fallback;
}

export function AccountSettingsDialog({ username, onClose, onUsernameChanged }: Props) {
  const [tab, setTab] = useState<Tab>("username");

  const [usernamePassword, setUsernamePassword] = useState("");
  const [newUsername, setNewUsername] = useState(username);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [shaking, setShaking] = useState(false);
  const shake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  };

  const handleChangeUsername = async () => {
    setError(null);
    setSuccess(null);
    const trimmed = newUsername.trim();
    if (trimmed.length < 3) {
      setError("Username must be at least 3 characters.");
      shake();
      return;
    }
    if (!usernamePassword) {
      setError("Enter your current password to confirm this change.");
      shake();
      return;
    }
    setLoading(true);
    try {
      const result = await changeUsername({ currentPassword: usernamePassword, newUsername: trimmed });
      onUsernameChanged(result.username);
      setUsernamePassword("");
      setSuccess("Username changed successfully.");
    } catch (err) {
      setError(extractError(err, "Failed to change username. Try again."));
      shake();
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setError(null);
    setSuccess(null);
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      shake();
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("New passwords do not match.");
      shake();
      setNewPassword("");
      setConfirmNewPassword("");
      return;
    }
    setLoading(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setSuccess("Password changed successfully.");
    } catch (err) {
      setError(extractError(err, "Failed to change password. Try again."));
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
          width: 360,
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
            <span style={{ fontSize: 14 }}>👤</span>
            <span
              style={{
                color: "white",
                fontFamily: "Tahoma, sans-serif",
                fontSize: 12,
                fontWeight: "bold",
                textShadow: "1px 1px rgba(0,0,0,0.5)",
              }}
            >
              Account Settings
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
              label="Username"
              active={tab === "username"}
              onClick={() => { setTab("username"); setError(null); setSuccess(null); }}
            />
            <TabBtn
              label="Password"
              active={tab === "password"}
              onClick={() => { setTab("password"); setError(null); setSuccess(null); }}
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
          {tab === "username" && (
            <div>
              <div style={{ marginBottom: 10 }}>
                <div style={LABEL}>New username:</div>
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  style={INPUT}
                  maxLength={32}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={LABEL}>Current password (to confirm):</div>
                <input
                  type="password"
                  value={usernamePassword}
                  onChange={e => setUsernamePassword(e.target.value)}
                  style={INPUT}
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
                <button onClick={handleChangeUsername} disabled={loading} style={{ ...XP_BTN, opacity: loading ? 0.6 : 1 }}>
                  Save Username
                </button>
                <button onClick={onClose} style={XP_BTN}>
                  Close
                </button>
              </div>
            </div>
          )}

          {tab === "password" && (
            <div>
              <div
                style={{
                  fontFamily: "Tahoma, sans-serif",
                  fontSize: 11,
                  color: "#555",
                  marginBottom: 12,
                  lineHeight: 1.4,
                }}
              >
                You'll stay signed in on this device. Other devices you're signed in on will stay signed in too.
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={LABEL}>Current password:</div>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  style={INPUT}
                />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={LABEL}>New password:</div>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={INPUT}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={LABEL}>Confirm new password:</div>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)}
                  style={INPUT}
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
                <button onClick={handleChangePassword} disabled={loading} style={{ ...XP_BTN, opacity: loading ? 0.6 : 1 }}>
                  Change Password
                </button>
                <button onClick={onClose} style={XP_BTN}>
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
