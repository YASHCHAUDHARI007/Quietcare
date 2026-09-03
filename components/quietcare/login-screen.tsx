"use client";

import { useState } from "react";
import Image from "next/image";
import { User, Activity, ArrowRight } from "lucide-react";

type LoginScreenProps = {
  onLoginSuccess: (user: { username: string; name: string; role: "caregiver" | "patient" }) => void;
  serverLive?: boolean;
};

export function LoginScreen({ onLoginSuccess, serverLive = true }: LoginScreenProps) {
  const [selectedRole, setSelectedRole] = useState<"caregiver" | "patient">("patient");
  const [username, setUsername] = useState("test");
  const [password, setPassword] = useState("test");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser) {
      setError("Please enter your username or email address.");
      return;
    }

    if (!cleanPass) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cleanUser,
          password: cleanPass,
          role: selectedRole,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        setError(data.message || "Invalid credentials. Use test / test");
        setLoading(false);
        return;
      }

      onLoginSuccess({
        username: data.user?.username || cleanUser,
        name: data.user?.name || (selectedRole === "patient" ? "Patient" : "Caregiver"),
        role: (data.user?.role as "caregiver" | "patient") || selectedRole,
      });
    } catch {
      setError("Network error while connecting to auth server. Please try again.");
      setLoading(false);
    }
  };

  const handleQuickPatientEnter = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "patient",
          password: "test",
          role: "patient",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        onLoginSuccess({
          username: data.user?.username || "patient",
          name: data.user?.name || "Parent",
          role: "patient",
        });
      } else {
        onLoginSuccess({
          username: "patient",
          name: "Parent",
          role: "patient",
        });
      }
    } catch {
      onLoginSuccess({
        username: "patient",
        name: "Parent",
        role: "patient",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen-wrapper" id="quietcare-login-screen">
      <div className="login-status-pill">
        <span
          className={`login-status-indicator ${
            serverLive ? "indicator-live" : "indicator-syncing"
          }`}
        />
        <span>
          {serverLive ? "Quietcare System Online" : "Connecting to Quietcare..."}
        </span>
      </div>

      <div className="login-card-content">
        <div className="login-brand-header">
          <div className="login-logo-circle">
            <Image
              src="/assets/brand/quietcare-logo.png"
              alt="Quietcare Logo"
              width={64}
              height={64}
              priority
            />
          </div>
          <h1 className="login-title">Quietcare Portal</h1>
          <p className="login-subtitle">
            {selectedRole === "patient"
              ? "Simple, large, and accessible view for today's medicine routine."
              : "Sign in to manage your parent's daily medicine routine and alerts."}
          </p>
        </div>

        {/* Role Selection Tabs */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginBottom: 16,
            background: "#f1f5f9",
            padding: 4,
            borderRadius: 12,
          }}
          id="portal-role-selector"
        >
          <button
            type="button"
            onClick={() => setSelectedRole("patient")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "10px 8px",
              borderRadius: 8,
              border: "none",
              background: selectedRole === "patient" ? "#ffffff" : "transparent",
              color: selectedRole === "patient" ? "#0f172a" : "#64748b",
              fontWeight: 700,
              fontSize: 13,
              boxShadow: selectedRole === "patient" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
              cursor: "pointer",
            }}
            id="role-tab-patient"
          >
            <User size={16} />
            <span>Patient View</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedRole("caregiver")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "10px 8px",
              borderRadius: 8,
              border: "none",
              background: selectedRole === "caregiver" ? "#ffffff" : "transparent",
              color: selectedRole === "caregiver" ? "#0f172a" : "#64748b",
              fontWeight: 700,
              fontSize: 13,
              boxShadow: selectedRole === "caregiver" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
              cursor: "pointer",
            }}
            id="role-tab-caregiver"
          >
            <Activity size={16} />
            <span>Caregiver</span>
          </button>
        </div>

        {error && (
          <div className="login-error-box" role="alert" id="login-error-banner">
            <span>!</span>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form-fields" id="caregiver-login-form">
          <div className="login-field-group">
            <label htmlFor="login-username-input">Username</label>
            <input
              id="login-username-input"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="test"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="login-text-input"
              required
            />
          </div>

          <div className="login-field-group">
            <div className="login-password-label-row">
              <label htmlFor="login-password-input">Password</label>
              <button
                type="button"
                className="login-toggle-pw"
                onClick={() => setShowPassword((prev) => !prev)}
                tabIndex={-1}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <input
              id="login-password-input"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="test"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-text-input"
              required
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontSize: 12,
              color: "#475569",
            }}
          >
            <span>
              Test login: <strong>test</strong> / <strong>test</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                setUsername("test");
                setPassword("test");
              }}
              style={{
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                padding: "3px 8px",
                borderRadius: 4,
                fontSize: 11,
                cursor: "pointer",
                fontWeight: 600,
                color: "#0f172a",
              }}
            >
              Fill test login
            </button>
          </div>

          <div className="login-checkbox-row">
            <label htmlFor="login-remember-me" className="login-checkbox-label">
              <input
                id="login-remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Remember me on this device</span>
            </label>
          </div>

          <button
            type="submit"
            id="login-submit-btn"
            disabled={loading}
            className="login-submit-button"
          >
            {loading
              ? "Signing in..."
              : selectedRole === "patient"
              ? "Sign In to Patient View"
              : "Sign In as Caregiver"}
          </button>
        </form>

        {/* Quick One-Click Direct Entry for Patient View */}
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={handleQuickPatientEnter}
            disabled={loading}
            style={{
              width: "100%",
              height: 46,
              background: "#f0fdf4",
              border: "1.5px solid #86efac",
              color: "#166534",
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
            }}
            id="quick-patient-view-btn"
          >
            <span>Enter Patient View Directly</span>
            <ArrowRight size={16} />
          </button>
        </div>

        <div className="login-footer-note">
          <span>Quietcare Medication Assistant • Secured Session</span>
        </div>
      </div>
    </div>
  );
}
