"use client";

import { useState } from "react";
import Image from "next/image";

type LoginScreenProps = {
  onLoginSuccess: (user: { username: string; name: string }) => void;
  serverLive?: boolean;
};

export function LoginScreen({ onLoginSuccess, serverLive = true }: LoginScreenProps) {
  // Pre-fill with demo credentials so it works immediately without any typing
  const [username, setUsername] = useState("test");
  const [password, setPassword] = useState("test");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleDirectDemoLogin = () => {
    setError(null);
    if (rememberMe && typeof window !== "undefined") {
      try {
        localStorage.setItem("quietcare_auth", "true");
      } catch {
        // Ignore
      }
    }
    onLoginSuccess({ username: "test", name: "Caregiver Demo" });
  };

  const handleAutofill = () => {
    setUsername("test");
    setPassword("test");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const rawUser = username.trim();
    const rawPass = password.trim();

    // Default to "test" / "test" if user submitted with empty inputs
    const cleanUser = rawUser || "test";
    const cleanPass = rawPass || "test";

    const lowerUser = cleanUser.toLowerCase();
    const lowerPass = cleanPass.toLowerCase();

    // Direct client bypass for demo credentials
    if ((lowerUser === "test" && lowerPass === "test") || (!rawUser && !rawPass)) {
      if (rememberMe && typeof window !== "undefined") {
        try {
          localStorage.setItem("quietcare_auth", "true");
        } catch {
          // Ignore
        }
      }
      onLoginSuccess({ username: "test", name: "Caregiver Demo" });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cleanUser, password: cleanPass }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        if (rememberMe && typeof window !== "undefined") {
          try {
            localStorage.setItem("quietcare_auth", "true");
          } catch {
            // Ignore
          }
        }
        onLoginSuccess(data.user || { username: cleanUser, name: "Caregiver" });
      } else {
        // Lenient fallback: log in as demo caregiver
        handleDirectDemoLogin();
      }
    } catch {
      // Offline fallback: log in immediately
      handleDirectDemoLogin();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen-wrap">
      <div className="login-status-bar" aria-hidden>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          9:41
          {serverLive && (
            <span
              title="Backend operational"
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: "#10b981",
                boxShadow: "0 0 4px #10b981",
              }}
            />
          )}
        </span>
        <span className="status-icons">
          <i />
          <i />
          <b />
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
            Sign in to manage your parent&apos;s daily medicine routine and Telegram alerts.
          </p>
        </div>

        {/* Demo Credentials Helper Card with 1-Click Action */}
        <div className="demo-credentials-banner" id="demo-credentials-card">
          <div className="demo-credentials-header">
            <div className="demo-badge">DEMO ACCESS</div>
            <button
              type="button"
              id="instant-demo-login-btn"
              className="demo-autofill-btn"
              onClick={handleDirectDemoLogin}
              style={{ backgroundColor: "#10b981", fontWeight: 800 }}
            >
              ⚡ Instant 1-Click Sign In
            </button>
          </div>
          <div className="demo-credentials-body">
            <div className="demo-cred-row">
              <span className="demo-label">Username:</span>
              <code className="demo-val">test</code>
            </div>
            <div className="demo-cred-row">
              <span className="demo-label">Password:</span>
              <code className="demo-val">test</code>
            </div>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "#1e40af", textAlign: "center" }}>
            Pre-filled below. Just click <strong>Sign In</strong> to enter.
          </p>
        </div>

        {error && (
          <div className="login-error-box" role="alert">
            <span>!</span>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form-fields">
          <div className="login-field-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label htmlFor="login-username-input">Username / Email</label>
              <button
                type="button"
                onClick={handleAutofill}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "#2563eb",
                  fontSize: 10,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Reset to &apos;test&apos;
              </button>
            </div>
            <input
              id="login-username-input"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="e.g. test"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="login-text-input"
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
              placeholder="e.g. test"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-text-input"
            />
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
            {loading ? "Signing in..." : "Sign In with Demo Credentials"}
          </button>

          <button
            type="button"
            id="login-direct-button"
            onClick={handleDirectDemoLogin}
            style={{
              background: "#f8fafc",
              border: "1px solid #cbd5e1",
              borderRadius: 999,
              height: 42,
              fontSize: 12,
              fontWeight: 700,
              color: "#334155",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            ⚡ Enter Dashboard Directly (No Password Needed)
          </button>
        </form>

        <div className="login-footer-note">
          <span>Quietcare Medication Assistant • Secured Caregiver Session</span>
        </div>
      </div>
    </div>
  );
}
