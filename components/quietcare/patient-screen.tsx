"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Check,
  X,
  AlertTriangle,
  Clock,
  Pill,
  PhoneCall,
  RefreshCw,
  User,
  ShieldAlert,
  ChevronRight,
  Sparkles,
  Calendar,
  LogOut,
  Activity,
} from "lucide-react";
import type { Dose, HelpRequest, PatientProfile } from "@/types/quietcare";
import {
  fetchTodayDoses,
  updateDoseStatusApi,
  fetchHelpRequests,
  createHelpRequestApi,
  updateHelpRequestStatusApi,
} from "@/lib/client/api";

type PatientScreenProps = {
  patientProfile?: PatientProfile;
  onSwitchToCaregiver: () => void;
  onLogout: () => void;
};

export function PatientScreen({
  patientProfile,
  onSwitchToCaregiver,
  onLogout,
}: PatientScreenProps) {
  const [doses, setDoses] = useState<Dose[]>([]);
  const [patientName, setPatientName] = useState<string>(
    patientProfile?.name || "Parent"
  );
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Success confirmation banner state
  const [confirmedDose, setConfirmedDose] = useState<{
    medicineName: string;
    doseAmount: string;
    takenAt: string;
  } | null>(null);

  // Remind later / Not yet temporary state
  const [notYetDose, setNotYetDose] = useState<{
    id: string;
    medicineName: string;
    doseAmount: string;
  } | null>(null);

  // Help Request states
  const [activeHelpRequest, setActiveHelpRequest] = useState<HelpRequest | null>(
    null
  );
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [helpLoading, setHelpLoading] = useState<boolean>(false);

  // Active navigation tab: "home" | "medicines" | "help"
  const [activeTab, setActiveTab] = useState<"home" | "medicines" | "help">(
    "home"
  );

  // Auto-dismiss confirmed banner timer
  const confirmTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Format current time of day greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  // Format ISO timestamp to readable 12-hour time
  const formatTimeLabel = (isoString?: string) => {
    if (!isoString) {
      return new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
    }
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch {
      return isoString;
    }
  };

  // Load doses and help requests from backend
  const loadData = useCallback(async () => {
    try {
      const [dosesRes, helpRes] = await Promise.all([
        fetchTodayDoses(),
        fetchHelpRequests(),
      ]);

      if (dosesRes && dosesRes.doses) {
        setDoses(dosesRes.doses);
        if (dosesRes.patientName) {
          setPatientName(dosesRes.patientName);
        }
      }

      if (helpRes && helpRes.activeRequests) {
        setActiveHelpRequest(helpRes.activeRequests[0] || null);
      }
    } catch (err) {
      console.error("[PatientScreen] Failed to load data:", err);
    }
  }, []);

  // Initial load + periodic polling every 5s for live caregiver sync
  useEffect(() => {
    let active = true;
    const fetchFresh = async () => {
      try {
        const [dosesRes, helpRes] = await Promise.all([
          fetchTodayDoses(),
          fetchHelpRequests(),
        ]);
        if (!active) return;
        if (dosesRes && dosesRes.doses) {
          setDoses(dosesRes.doses);
          if (dosesRes.patientName) {
            setPatientName(dosesRes.patientName);
          }
        }
        if (helpRes && helpRes.activeRequests) {
          setActiveHelpRequest(helpRes.activeRequests[0] || null);
        }
      } catch (err) {
        console.error("[PatientScreen] Initial load error:", err);
      }
    };

    fetchFresh();
    const interval = setInterval(fetchFresh, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // YES Flow: Mark dose as taken
  const handleYesTookIt = async (dose: Dose) => {
    setActionLoadingId(dose.id);
    try {
      const res = await updateDoseStatusApi(dose.id, "taken", "patient_ui");
      if (res.success && res.dose) {
        // Clear any previous remind later state
        setNotYetDose(null);

        // Show large accessible confirmation banner
        const takenTime = formatTimeLabel(res.dose.takenAt);
        setConfirmedDose({
          medicineName: dose.medicineName,
          doseAmount: dose.doseAmount,
          takenAt: takenTime,
        });

        // Clear existing timer if any
        if (confirmTimerRef.current) {
          clearTimeout(confirmTimerRef.current);
        }

        // Auto dismiss confirmation after 3.5 seconds
        confirmTimerRef.current = setTimeout(() => {
          setConfirmedDose(null);
        }, 3500);

        // Refresh doses immediately from backend
        await loadData();
      }
    } catch (err) {
      console.error("[PatientScreen] Error marking taken:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // NO Flow: User clicked "No, not yet"
  // Requirement 3 & 18: DO NOT immediately mark as missed!
  const handleNoNotYet = async (dose: Dose) => {
    setActionLoadingId(dose.id);
    try {
      // Record status as "not_yet" in backend so caregiver sees not yet, but dose is NOT missed
      await updateDoseStatusApi(dose.id, "not_yet", "patient_ui");

      // Show calm reassurance card
      setNotYetDose({
        id: dose.id,
        medicineName: dose.medicineName,
        doseAmount: dose.doseAmount,
      });

      await loadData();
    } catch (err) {
      console.error("[PatientScreen] Error recording not yet:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Help Request Flow
  const handleConfirmHelp = async () => {
    setHelpLoading(true);
    try {
      const res = await createHelpRequestApi(
        "Patient requested assistance from the Patient View"
      );
      if (res.success && res.data) {
        setActiveHelpRequest(res.data);
        setShowHelpModal(false);
      }
    } catch (err) {
      console.error("[PatientScreen] Error requesting help:", err);
    } finally {
      setHelpLoading(false);
    }
  };

  const handleCancelHelp = async (requestId: string) => {
    setHelpLoading(true);
    try {
      const res = await updateHelpRequestStatusApi(requestId, "resolved");
      if (res.success) {
        setActiveHelpRequest(null);
      }
    } catch (err) {
      console.error("[PatientScreen] Error canceling help:", err);
    } finally {
      setHelpLoading(false);
    }
  };

  // Categorize doses
  const takenDoses = doses.filter((d) => d.status === "taken");
  const missedDoses = doses.filter((d) => d.status === "missed");

  // Filter current active medicines to prioritize:
  // 1. Doses with reminder_sent or not_yet or pending scheduled now
  // 2. Or missed doses
  const pendingOrReminderDoses = doses.filter(
    (d) => d.status === "reminder_sent" || d.status === "pending" || d.status === "not_yet"
  );

  const totalDoses = doses.length;
  const takenCount = takenDoses.length;
  const allTaken = totalDoses > 0 && takenCount === totalDoses;

  return (
    <div className="patient-app-wrapper" id="patient-app-root">
      {/* Top Header */}
      <header className="patient-header" id="patient-top-header">
        <div className="patient-header-left">
          <div className="patient-avatar-badge" aria-hidden="true">
            <User size={22} color="#0f172a" />
          </div>
          <div>
            <h2 className="patient-welcome-title">
              {getGreeting()}, {patientName || "Parent"} 👋
            </h2>
            <p className="patient-subtitle">Quietcare Medicine Helper</p>
          </div>
        </div>

        <div className="patient-header-right">
          <button
            type="button"
            className="patient-switch-role-btn"
            onClick={onSwitchToCaregiver}
            title="Switch to Caregiver Dashboard"
            id="switch-to-caregiver-btn"
          >
            <Activity size={15} />
            <span>Caregiver Portal</span>
          </button>
          <button
            type="button"
            className="patient-logout-btn"
            onClick={onLogout}
            title="Sign out"
            id="patient-logout-btn"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Simple Navigation Tabs */}
      <nav className="patient-nav-tabs" aria-label="Patient Navigation" id="patient-nav-tabs">
        <button
          type="button"
          className={`patient-nav-tab ${activeTab === "home" ? "patient-nav-tab--active" : ""}`}
          onClick={() => setActiveTab("home")}
          id="patient-tab-home"
        >
          <Pill size={18} />
          <span>Today&apos;s Medicine</span>
        </button>
        <button
          type="button"
          className={`patient-nav-tab ${activeTab === "medicines" ? "patient-nav-tab--active" : ""}`}
          onClick={() => setActiveTab("medicines")}
          id="patient-tab-medicines"
        >
          <Calendar size={18} />
          <span>All ({totalDoses})</span>
        </button>
        <button
          type="button"
          className={`patient-nav-tab patient-nav-tab--help ${activeTab === "help" ? "patient-nav-tab--active" : ""}`}
          onClick={() => setActiveTab("help")}
          id="patient-tab-help"
        >
          <PhoneCall size={18} />
          <span>Need Help</span>
        </button>
      </nav>

      {/* Main Body */}
      <main className="patient-content-container" id="patient-main-content">
        {/* Active Help Request Banner (Survives reload & visible across tabs) */}
        {activeHelpRequest && (
          <section className="patient-help-active-banner" id="patient-help-active-banner">
            <div className="patient-help-icon-wrap">
              <ShieldAlert size={30} color="#b91c1c" />
            </div>
            <div style={{ flex: 1 }}>
              <h3 className="patient-help-active-heading">🆘 Help Requested</h3>
              <p className="patient-help-active-sub">
                Your caregiver has been notified. Please stay calm.
              </p>
              <span className="patient-help-active-time">
                Requested at: {formatTimeLabel(activeHelpRequest.createdAt)}
              </span>
            </div>
            <button
              type="button"
              className="patient-cancel-help-btn"
              onClick={() => handleCancelHelp(activeHelpRequest.id)}
              disabled={helpLoading}
              id="patient-cancel-help-btn"
            >
              {helpLoading ? "Updating..." : "Cancel Request"}
            </button>
          </section>
        )}

        {/* Success Confirmation Banner (YES Flow) */}
        {confirmedDose && (
          <div className="patient-confirmation-card" id="patient-confirmed-card">
            <div className="patient-check-circle">
              <Check size={36} color="#15803d" strokeWidth={3} />
            </div>
            <h3 className="patient-confirmation-title">✓ Medicine Taken</h3>
            <p className="patient-confirmation-med">
              <strong>{confirmedDose.medicineName}</strong> {confirmedDose.doseAmount}
            </p>
            <p className="patient-confirmation-time">
              Taken at {confirmedDose.takenAt}
            </p>
            <div className="patient-confirmation-praise">Well done! 🎉</div>
            <button
              type="button"
              className="patient-confirmation-dismiss-btn"
              onClick={() => setConfirmedDose(null)}
            >
              Continue <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* Remind Later / No Not Yet Reassurance Card (NO Flow) */}
        {notYetDose && (
          <div className="patient-not-yet-card" id="patient-not-yet-card">
            <div className="patient-not-yet-header">
              <Clock size={28} color="#0369a1" />
              <div>
                <h3 className="patient-not-yet-title">No problem.</h3>
                <p className="patient-not-yet-sub">We&apos;ll remind you again soon.</p>
              </div>
            </div>
            <div className="patient-not-yet-med-info">
              <span>Medicine:</span>
              <strong>{notYetDose.medicineName} {notYetDose.doseAmount}</strong>
            </div>
            <div className="patient-not-yet-actions">
              <button
                type="button"
                className="patient-remind-later-btn"
                onClick={() => setNotYetDose(null)}
                id="patient-dismiss-not-yet-btn"
              >
                Remind Me Later
              </button>
              <button
                type="button"
                className="patient-took-it-now-btn"
                onClick={() => {
                  const target = doses.find((d) => d.id === notYetDose.id);
                  if (target) {
                    handleYesTookIt(target);
                  } else {
                    setNotYetDose(null);
                  }
                }}
                id="patient-took-it-now-btn"
              >
                ✓ I Took It Now
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: HOME (Currently Due / Next Medicine) */}
        {activeTab === "home" && (
          <div className="patient-tab-content">
            {/* Missed Doses Section (if any) */}
            {missedDoses.length > 0 && (
              <div className="patient-missed-section" id="patient-missed-section">
                {missedDoses.map((dose) => (
                  <div key={dose.id} className="patient-missed-card" id={`patient-missed-${dose.id}`}>
                    <div className="patient-missed-header">
                      <AlertTriangle size={26} color="#b91c1c" />
                      <div>
                        <h4 className="patient-missed-title">⚠️ Medicine Missed</h4>
                        <p className="patient-missed-desc">
                          You haven&apos;t confirmed this medicine yet.
                        </p>
                      </div>
                    </div>
                    <div className="patient-missed-details">
                      <div className="patient-med-name-large">💊 {dose.medicineName}</div>
                      <div className="patient-med-dose-text">
                        {dose.doseAmount} • Scheduled for {dose.scheduledTimeLabel}
                      </div>
                    </div>
                    <div className="patient-missed-actions">
                      <button
                        type="button"
                        className="patient-btn-yes"
                        onClick={() => handleYesTookIt(dose)}
                        disabled={actionLoadingId === dose.id}
                      >
                        {actionLoadingId === dose.id ? "Saving..." : "✓ I Took It"}
                      </button>
                      <button
                        type="button"
                        className="patient-btn-help-inline"
                        onClick={() => setShowHelpModal(true)}
                      >
                        🆘 I NEED HELP
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Currently Due Medicines (One at a time or Due Now cards) */}
            {pendingOrReminderDoses.length > 0 ? (
              <div className="patient-due-section">
                <div className="patient-section-badge">
                  <span className="patient-pulse-dot" />
                  Your medicine is due
                </div>

                {pendingOrReminderDoses.slice(0, 2).map((dose, idx) => (
                  <div
                    key={dose.id}
                    className="patient-medicine-hero-card"
                    id={`patient-due-card-${dose.id}`}
                  >
                    {pendingOrReminderDoses.length > 1 && (
                      <div className="patient-card-step-badge">
                        Medicine {idx + 1} of {pendingOrReminderDoses.length} due
                      </div>
                    )}

                    <div className="patient-due-time-badge">
                      <Clock size={20} />
                      <span>{dose.scheduledTimeLabel}</span>
                      <span className="patient-timing-label">• {dose.timing}</span>
                    </div>

                    <div className="patient-med-hero-body">
                      <div className="patient-pill-icon-box">💊</div>
                      <div className="patient-med-hero-text">
                        <h3 className="patient-med-hero-name">{dose.medicineName}</h3>
                        <p className="patient-med-hero-dose">{dose.doseAmount}</p>
                      </div>
                    </div>

                    <div className="patient-question-banner">
                      Did you take your medicine?
                    </div>

                    {/* TWO VERY CLEAR YES / NO BUTTONS */}
                    <div className="patient-yes-no-group">
                      <button
                        type="button"
                        className="patient-btn-yes"
                        onClick={() => handleYesTookIt(dose)}
                        disabled={actionLoadingId === dose.id}
                        id={`patient-btn-yes-${dose.id}`}
                      >
                        {actionLoadingId === dose.id ? (
                          <>
                            <RefreshCw size={22} className="patient-spin-icon" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Check size={26} strokeWidth={3} />
                            <span>YES, I TOOK IT</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        className="patient-btn-no"
                        onClick={() => handleNoNotYet(dose)}
                        disabled={actionLoadingId === dose.id}
                        id={`patient-btn-no-${dose.id}`}
                      >
                        <X size={22} strokeWidth={2.5} />
                        <span>NO, NOT YET</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : allTaken ? (
              /* All Medicines Taken Celebration */
              <div className="patient-all-done-card" id="patient-all-done-card">
                <div className="patient-all-done-icon">
                  <Sparkles size={42} color="#16a34a" />
                </div>
                <h3 className="patient-all-done-title">🌟 All Done for Today!</h3>
                <p className="patient-all-done-sub">
                  You have taken all your scheduled medicines for today. Well done!
                </p>
                <div className="patient-all-done-list">
                  {takenDoses.map((td) => (
                    <div key={td.id} className="patient-all-done-item">
                      <Check size={18} color="#16a34a" />
                      <span>
                        <strong>{td.medicineName}</strong> ({td.doseAmount}) — Taken at{" "}
                        {formatTimeLabel(td.takenAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Upcoming medicine placeholder */
              <div className="patient-no-due-card">
                <Clock size={36} color="#64748b" />
                <h3 style={{ fontSize: 20, margin: "10px 0 4px", color: "#0f172a" }}>
                  No medicines due right now
                </h3>
                <p style={{ fontSize: 15, color: "#475569", margin: 0 }}>
                  Your next medicine will appear here when it is time.
                </p>
              </div>
            )}

            {/* TODAY'S SIMPLE STATUS SUMMARY */}
            <section className="patient-status-summary-card" id="patient-status-summary">
              <div className="patient-summary-header">
                <h4 className="patient-summary-title">Today&apos;s Medicines</h4>
                <span className="patient-summary-count">
                  {takenCount} of {totalDoses} taken
                </span>
              </div>

              {/* Visual Progress Bar */}
              <div className="patient-progress-bar-wrap">
                <div
                  className="patient-progress-bar-fill"
                  style={{
                    width: totalDoses > 0 ? `${(takenCount / totalDoses) * 100}%` : "0%",
                  }}
                />
              </div>

              {/* Simple readable item list */}
              <div className="patient-summary-items">
                {doses.map((dose) => {
                  const isTaken = dose.status === "taken";
                  const isMissed = dose.status === "missed";
                  return (
                    <div
                      key={dose.id}
                      className={`patient-summary-row ${
                        isTaken
                          ? "patient-summary-row--taken"
                          : isMissed
                          ? "patient-summary-row--missed"
                          : "patient-summary-row--upcoming"
                      }`}
                    >
                      <div className="patient-row-status-icon">
                        {isTaken ? (
                          <Check size={18} color="#15803d" strokeWidth={3} />
                        ) : isMissed ? (
                          <AlertTriangle size={18} color="#b91c1c" />
                        ) : (
                          <Clock size={18} color="#64748b" />
                        )}
                      </div>
                      <div className="patient-row-details">
                        <strong className="patient-row-name">{dose.medicineName}</strong>
                        <span className="patient-row-timing">
                          {dose.scheduledTimeLabel} • {dose.timing}
                        </span>
                      </div>
                      <div className="patient-row-badge">
                        {isTaken
                          ? `✓ Taken${dose.takenAt ? ` at ${formatTimeLabel(dose.takenAt)}` : ""}`
                          : isMissed
                          ? "⚠️ Missed"
                          : "⏳ Upcoming"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* PROMINENT "I NEED HELP" BUTTON */}
            <div className="patient-help-button-container">
              <button
                type="button"
                className="patient-btn-help-primary"
                onClick={() => setShowHelpModal(true)}
                id="patient-primary-help-btn"
              >
                <PhoneCall size={26} />
                <span>🆘 I NEED HELP</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: ALL MEDICINES LIST */}
        {activeTab === "medicines" && (
          <div className="patient-tab-content">
            <div className="patient-all-meds-header">
              <h3 className="patient-all-meds-title">All Today&apos;s Medicines</h3>
              <p className="patient-all-meds-sub">
                Here is everything scheduled for you today.
              </p>
            </div>

            <div className="patient-all-meds-list">
              {doses.map((dose) => {
                const isTaken = dose.status === "taken";
                return (
                  <div
                    key={dose.id}
                    className={`patient-all-med-card ${
                      isTaken ? "patient-all-med-card--taken" : ""
                    }`}
                  >
                    <div className="patient-all-med-left">
                      <div className="patient-all-med-icon">💊</div>
                      <div>
                        <h4 className="patient-all-med-name">{dose.medicineName}</h4>
                        <p className="patient-all-med-meta">
                          {dose.doseAmount} • {dose.scheduledTimeLabel} ({dose.timing})
                        </p>
                        {isTaken && (
                          <p className="patient-all-med-taken-note">
                            ✓ Taken at {formatTimeLabel(dose.takenAt)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="patient-all-med-right">
                      {isTaken ? (
                        <div className="patient-badge-done">✓ Taken</div>
                      ) : (
                        <button
                          type="button"
                          className="patient-small-take-btn"
                          onClick={() => handleYesTookIt(dose)}
                          disabled={actionLoadingId === dose.id}
                        >
                          {actionLoadingId === dose.id ? "Saving..." : "Take Now"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: HELP & EMERGENCY */}
        {activeTab === "help" && (
          <div className="patient-tab-content">
            <div className="patient-help-screen-card">
              <div className="patient-help-screen-icon">
                <ShieldAlert size={48} color="#b91c1c" />
              </div>
              <h3 className="patient-help-screen-title">Caregiver Assistance</h3>
              <p className="patient-help-screen-sub">
                If you feel unwell, have trouble with your medicines, or need urgent
                help, tap the red button below.
              </p>

              {activeHelpRequest ? (
                <div className="patient-help-active-box">
                  <div className="patient-active-badge">● Active Alert</div>
                  <p>
                    Your caregiver has been alerted and received your request.
                  </p>
                  <p style={{ fontSize: 13, color: "#64748b" }}>
                    Sent at {formatTimeLabel(activeHelpRequest.createdAt)}
                  </p>
                  <button
                    type="button"
                    className="patient-cancel-help-btn"
                    onClick={() => handleCancelHelp(activeHelpRequest.id)}
                    disabled={helpLoading}
                    style={{ marginTop: 12 }}
                  >
                    Cancel Help Request
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="patient-btn-help-primary"
                  onClick={() => setShowHelpModal(true)}
                  style={{ width: "100%", marginTop: 20 }}
                >
                  <PhoneCall size={26} />
                  <span>🆘 I NEED HELP</span>
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* CONFIRMATION MODAL: "I NEED HELP" */}
      {showHelpModal && (
        <div className="patient-modal-overlay" role="dialog" aria-modal="true">
          <div className="patient-modal-sheet" id="patient-help-confirmation-dialog">
            <div className="patient-modal-icon-wrap">
              <AlertTriangle size={42} color="#b91c1c" />
            </div>
            <h3 className="patient-modal-title">Need Help?</h3>
            <p className="patient-modal-message">
              Do you need help from your caregiver?
            </p>

            <div className="patient-modal-actions">
              <button
                type="button"
                className="patient-modal-btn-confirm"
                onClick={handleConfirmHelp}
                disabled={helpLoading}
                id="patient-confirm-help-btn"
              >
                {helpLoading ? (
                  "Calling Caregiver..."
                ) : (
                  <>
                    <PhoneCall size={22} />
                    <span>YES, CALL FOR HELP</span>
                  </>
                )}
              </button>

              <button
                type="button"
                className="patient-modal-btn-cancel"
                onClick={() => setShowHelpModal(false)}
                disabled={helpLoading}
                id="patient-cancel-help-modal-btn"
              >
                <X size={20} />
                <span>CANCEL</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
