"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { dinnerTimes, languages, mealTimes, medicines as initialMedicinesList, patient as initialPatient } from "@/data/mock-data";
import { calculateCoverage } from "@/lib/routine";
import type {
  FlowScreen,
  Medicine,
  PatientProfile,
  PrescriptionRecord,
  QuietcareProgress,
  TelegramConnection,
} from "@/types/quietcare";
import {
  connectTelegram,
  fetchAppState,
  saveRoutineSettings,
  updateMedicineQuantity,
  updateMedicineTiming,
  uploadPrescriptionFile,
} from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Camera, Check, Download, Edit, Expand, Folder, Moon, Plus, Share, Sun, UserCircle } from "./icons";
import { LoginScreen } from "./login-screen";

const initialProgress: QuietcareProgress = { screen: "home", timingConfirmed: false, language: "Marathi", breakfast: "8:00 am", dinner: "7:30 pm" };
const backMap: Partial<Record<FlowScreen, FlowScreen>> = { "prescription-upload": "welcome", "prescription-review": "prescription-upload", "medicine-upload": "prescription-review", "medicine-review": "medicine-upload", personalise: "medicine-review", "routine-ready": "personalise", "labels-choice": "routine-ready", labels: "labels-choice", pack: "labels", connect: "pack", waiting: "connect", connected: "waiting" };

function StatusBar({ home = false, serverLive = true }: { home?: boolean; serverLive?: boolean }) {
  return (
    <div className={`status-bar${home ? " status-bar--home" : ""}`} aria-hidden>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        9:41
        {serverLive && (
          <span
            title="Backend server connected"
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
  );
}

function FlowHeader({ screen, onBack, onExit }: { screen: FlowScreen; onBack: () => void; onExit?: () => void }) {
  const values: Partial<Record<FlowScreen, number>> = { "prescription-upload": 12, "prescription-review": 24, "medicine-upload": 34, "medicine-review": 44, personalise: 56, "labels-choice": 68, labels: 78, pack: 86, connect: 92, waiting: 96, connected: 100 };
  if (!(screen in values)) return null;
  return (
    <div className="flow-header">
      <button className="icon-button" onClick={onBack} aria-label="Go back">
        <ArrowLeft />
      </button>
      <div className="progress-track">
        <span style={{ width: `${values[screen]}%` }} />
      </div>
      {onExit ? (
        <button type="button" className="flow-exit-btn" onClick={onExit} title="Return to Dashboard">
          Exit
        </button>
      ) : (
        <span className="flow-spacer" />
      )}
    </div>
  );
}
function Bottom({ children }: { children: React.ReactNode }) { return <div className="bottom-actions">{children}</div>; }
function CaptureArt({ kind }: { kind: "prescription" | "medicine" }) {
  const source = kind === "prescription" ? "/assets/illustrations/upload-prescription.png" : "/assets/illustrations/add-medicines.png";
  return <div className={`capture-art capture-art--${kind}`}><Image src={source} alt="" fill sizes="190px" priority /></div>;
}
function Spinner() { return <span className="spinner" aria-hidden />; }
function LoadingScreen({ title, detail }: { title: string; detail: string }) { return <main className="center-screen" aria-live="polite"><Spinner /><h1>{title}</h1><p>{detail}</p></main>; }

function MedicineList({
  medicineItems,
  timingConfirmed,
  onEdit,
}: {
  medicineItems: Medicine[];
  timingConfirmed: boolean;
  onEdit: () => void;
}) {
  const uncertainMed = medicineItems.find((m) => m.uncertain);
  const regularMeds = timingConfirmed
    ? medicineItems
    : medicineItems.filter((m) => !m.uncertain);

  return (
    <div className="medicine-list">
      {!timingConfirmed && uncertainMed && (
        <article className="medicine-card medicine-card--warning">
          <div className="warning-label">
            <span>!</span> Timing unclear
          </div>
          <h3>{uncertainMed.name}</h3>
          <p>
            {uncertainMed.schedule} <b>•</b> {uncertainMed.timing} <b>•</b> {uncertainMed.days} days
          </p>
          <Button onClick={onEdit}>Check timing</Button>
        </article>
      )}
      <div className="medicine-group">
        {regularMeds.map((medicine) => (
          <article className="medicine-row" key={medicine.id}>
            <div>
              <h3>{medicine.name}</h3>
              <p>
                {medicine.schedule} <b>•</b> {medicine.timing} <b>•</b> {medicine.days} days
              </p>
              <small>Special instructions</small>
            </div>
            <button className="edit-button" onClick={onEdit} aria-label={`Edit ${medicine.name}`}>
              <Edit />
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

function EditPrescription({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (timing: string) => void;
}) {
  const timings = ["Before breakfast", "After breakfast", "Before lunch", "After lunch", "Before dinner", "After dinner", "SOS"];
  const [selectedTiming, setSelectedTiming] = useState("After breakfast");

  return (
    <div className="modal-scrim">
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="edit-title">
        <div className="sheet-header">
          <h2 id="edit-title">Edit</h2>
          <button onClick={onClose} aria-label="Close">
            <Image src="/assets/icons/close.svg" alt="" width={24} height={24} />
          </button>
        </div>
        <label>
          Medicine Name
          <input value="Vertin 2mg" readOnly />
        </label>
        <label>
          Dosage Days
          <input value="3" readOnly />
        </label>
        <fieldset>
          <legend>When is it supposed to be taken</legend>
          {timings.map((timing) => (
            <label className="check-row" key={timing}>
              <input
                type="radio"
                name="prescription-timing"
                checked={selectedTiming === timing}
                onChange={() => setSelectedTiming(timing)}
              />
              <span>
                <Check size={13} />
              </span>
              {timing}
            </label>
          ))}
        </fieldset>
        <div className="sheet-actions">
          <Button variant="danger" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(selectedTiming)}>Save</Button>
        </div>
      </section>
    </div>
  );
}

function UploadActions({ onChoose, onTake, selectedName }: { onChoose: () => void; onTake: () => void; selectedName?: string }) {
  return <Bottom>{selectedName && <div className="file-chip">Selected: {selectedName}</div>}<div className="split-actions"><Button variant="secondary" onClick={onChoose}><Folder /> Choose photo</Button><Button onClick={onTake}><Camera /> Take photo</Button></div></Bottom>;
}

function UploadModal({ medicine, onClose, onSelect }: { medicine: boolean; onClose: () => void; onSelect: (file?: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return <div className="modal-scrim modal-scrim--center"><section className="upload-dialog" role="dialog" aria-modal="true" aria-labelledby="upload-title"><div className="sheet-header"><h2 id="upload-title">Upload {medicine ? "medicine photo" : "prescription"}</h2><button onClick={onClose} aria-label="Close"><Image src="/assets/icons/close.svg" alt="" width={24} height={24} /></button></div><div className="upload-drop"><Folder size={32}/><strong>Choose a file from your device</strong><span>{medicine ? "JPG or PNG" : "JPG, PNG or PDF"}</span><Button onClick={() => input.current?.click()}>Browse files</Button><input ref={input} className="sr-only" type="file" accept={medicine ? "image/*" : "image/*,.pdf,application/pdf"} onChange={(event) => onSelect(event.target.files?.[0])}/></div><Button variant="secondary" onClick={onClose}>Cancel</Button></section></div>;
}

function PrescriptionReview({
  timingConfirmed,
  medicinesList,
  patientName,
  courseDays,
  onEdit,
  onContinue,
  onExpand,
}: {
  timingConfirmed: boolean;
  medicinesList: Medicine[];
  patientName: string;
  courseDays: number;
  onEdit: () => void;
  onContinue: () => void;
  onExpand: () => void;
}) {
  const uncertainCount = medicinesList.filter((m) => m.uncertain).length;
  return (
    <main className="screen-content screen-content--review">
      <h1>Review prescription</h1>
      <p>
        We found {medicinesList.length} medicines. Check {timingConfirmed || uncertainCount === 0 ? "the details" : `${uncertainCount} unclear detail`} before continuing.
      </p>
      <div className="prescription-preview">
        <Image src="/assets/images/prescription.png" alt="Uploaded prescription" fill sizes="342px" priority />
        <button type="button" aria-label="Expand prescription" onClick={onExpand}>
          <Expand size={18} />
        </button>
        <div>
          {patientName} <b>•</b> {courseDays} days course
        </div>
      </div>
      <MedicineList
        medicineItems={medicinesList}
        timingConfirmed={timingConfirmed}
        onEdit={onEdit}
      />
      <Bottom>
        <Button
          variant="primary"
          onClick={timingConfirmed || uncertainCount === 0 ? onContinue : onEdit}
        >
          {timingConfirmed || uncertainCount === 0 ? "Confirm Prescription" : "Check 1 Unclear Detail"}
        </Button>
      </Bottom>
    </main>
  );
}

function MedicineReview({ onEdit, onContinue }: { onEdit: () => void; onContinue: () => void }) {
  const tags: Array<[number, number, string, string]> = [[2,32,"Glycomet 500mg","20 Tab"],[55,31,"Telma 40mg","20 Tab"],[4,48,"Atorvastatin","20 Tab"],[67,60,"Dolo 500mg","20 Tab"],[2,70,"Glimepride","20 Tab"],[35,64,"Lumia 60k","8 Cap"],[38,77,"Pan 40mg","20 Tab"],[2,91,"Amlodipine","20 Tab"],[37,93,"Pan 40mg","20 Tab"],[69,91,"Ecosprin","20 Tab"]];
  return <main className="photo-review"><div className="medicine-photo"><Image src="/assets/images/medicines-flatlay.png" alt="Detected medicine packages laid flat" fill sizes="390px" priority /><button onClick={onEdit} aria-label="Edit matches"><Edit /></button>{tags.map(([x,y,name,qty]) => <span className="detection-tag" style={{ left: `${x}%`, top: `${y}%` }} key={`${name}-${x}-${y}`}>{name}<b>{qty}</b></span>)}</div><Bottom><Button onClick={onContinue}>Confirm Prescription</Button></Bottom></main>;
}

function EditMedicine({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (qty: number) => void;
}) {
  const [qty, setQty] = useState(20);
  return (
    <div className="modal-scrim">
      <section className="sheet sheet--short" role="dialog" aria-modal="true">
        <div className="sheet-header">
          <h2>Edit match</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <Image src="/assets/icons/close.svg" alt="" width={24} height={24} />
          </button>
        </div>
        <label>
          Match with Prescription
          <select defaultValue="Vertin 2mg">
            <option>Vertin 2mg</option>
            <option>Metformin 500mg</option>
            <option>Telma 40mg</option>
          </select>
        </label>
        <label>
          Available Quantity (Tablets/Units)
          <input
            type="number"
            value={qty}
            min="1"
            max="100"
            onChange={(e) => setQty(Number(e.target.value) || 0)}
          />
        </label>
        <div className="sheet-actions">
          <Button variant="danger" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(qty)}>Save</Button>
        </div>
      </section>
    </div>
  );
}

function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  return (
    <div className="modal-scrim modal-scrim--center" onClick={onClose}>
      <div
        className="upload-dialog"
        style={{ padding: 16, position: "relative", maxWidth: 360 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-header" style={{ margin: "0 0 12px", border: "none" }}>
          <h2>Prescription Preview</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <Image src="/assets/icons/close.svg" alt="" width={24} height={24} />
          </button>
        </div>
        <div style={{ position: "relative", width: "100%", height: 320, borderRadius: 12, overflow: "hidden" }}>
          <Image src={src} alt={alt} fill style={{ objectFit: "contain" }} />
        </div>
        <div style={{ marginTop: 12 }}>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function DetailModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-scrim" onClick={onClose}>
      <section
        className="sheet"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-header">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <Image src="/assets/icons/close.svg" alt="" width={24} height={24} />
          </button>
        </div>
        {children}
        <div style={{ marginTop: 16 }}>
          <Button onClick={onClose}>Done</Button>
        </div>
      </section>
    </div>
  );
}

function LabelsPreview() {
  const labels = [
    ["before-breakfast.png", "Before breakfast"],
    ["after-breakfast.png", "After breakfast"],
    ["before-dinner.png", "Before dinner"],
    ["after-dinner.png", "After dinner"],
  ];
  return (
    <div className="labels-card">
      <p>4 &nbsp; pouch labels</p>
      <div className="label-grid">
        {labels.map(([file, alt]) => (
          <Image key={file} src={`/assets/pouch-labels/${file}`} alt={alt} width={150} height={184} />
        ))}
      </div>
    </div>
  );
}

function HomeScreen({
  patientData,
  medicinesList,
  doseTaken,
  onToggleDose,
  onAddPrescription,
  onOpenSetup,
  onOpenReview,
  onOpenRoutine,
  onOpenPrepare,
  onOpenRecords,
  onOpenProfile,
  onLogout,
}: {
  patientData: PatientProfile;
  medicinesList: Medicine[];
  doseTaken: boolean;
  onToggleDose: () => void;
  onAddPrescription: () => void;
  onOpenSetup: () => void;
  onOpenReview: () => void;
  onOpenRoutine: () => void;
  onOpenPrepare: () => void;
  onOpenRecords: (type: "prescriptions" | "stock") => void;
  onOpenProfile: () => void;
  onLogout: () => void;
}) {
  return (
    <main className="home-screen">
      <header className="home-header">
        <strong>quietcare</strong>
        <div style={{ position: "absolute", right: 16, top: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            className="header-logout-btn"
            onClick={onLogout}
            title="Sign out of demo session"
          >
            Sign Out
          </button>
          <button
            type="button"
            aria-label="Profile"
            onClick={onOpenProfile}
            style={{ border: 0, background: "transparent", cursor: "pointer", display: "grid", placeItems: "center" }}
          >
            <UserCircle size={24} />
          </button>
        </div>
        <span onClick={onOpenProfile} style={{ cursor: "pointer" }}>
          {patientData.name}
          <Image src="/assets/icons/chevron-down.svg" alt="" width={14} height={14} />
        </span>
      </header>
      <div className="nav-pill-group">
        <button type="button" className="nav-pill nav-pill--active">
          Meena&apos;s Routine
        </button>
        <button type="button" className="nav-pill" onClick={onOpenSetup}>
          Setup Walkthrough
        </button>
        <button type="button" className="nav-pill" onClick={onLogout} title="Open Demo Login Page">
          Demo Login
        </button>
      </div>
      <div className="home-body">
        <section className="today-card dose-card-interactive">
          <div className="section-title">
            <h2>Today</h2>
            <span style={{ background: doseTaken ? "#15803d" : "#16a34a" }}>
              {doseTaken ? "All doses completed" : "On track"}
            </span>
          </div>
          <div className="today-grid">
            <div
              className="dose-ring"
              style={{
                background: doseTaken
                  ? "conic-gradient(#22c55e 0 100%, #22c55e 100% 100%)"
                  : "conic-gradient(#22c55e 0 50%, #cbd5e1 50% 100%)",
              }}
            >
              <span>{doseTaken ? "Today" : "Doses"}</span>
              <b>{doseTaken ? "2 / 2" : "1 / 2"}</b>
            </div>
            <div className="dose-times">
              <div className="dose-item-action">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Sun size={24} />
                  <span>
                    2:30 PM<strong>After Lunch</strong>
                  </span>
                </div>
                <span className="dose-toggle-tag dose-toggle-tag--taken">✓ Taken</span>
              </div>
              <div
                className="dose-item-action"
                onClick={onToggleDose}
                title="Click to toggle dose taken"
                role="button"
                tabIndex={0}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Moon size={24} />
                  <span>
                    7:30 PM<strong>Before Dinner</strong>
                  </span>
                </div>
                <span
                  className={`dose-toggle-tag ${
                    doseTaken ? "dose-toggle-tag--taken" : ""
                  }`}
                >
                  {doseTaken ? "✓ Taken" : "Mark Taken"}
                </span>
              </div>
            </div>
          </div>
        </section>
        <section className="refill-alert">
          <b>!</b>
          <span>
            <strong>Telma 40 may run out soon</strong>About 4 days remaining
          </span>
          <button type="button" onClick={onOpenReview}>
            Review
          </button>
        </section>
        <h2 className="home-section-title">Prepared Pouches</h2>
        <section className="pouches-card">
          <div>
            <span>
              {patientData.name}&apos;s routine<strong>Prepared through {patientData.preparedThrough}</strong>
            </span>
            <b>{patientData.daysLeft} days left</b>
          </div>
          <Image src="/assets/images/prepared-pouches.png" alt="Four prepared medicine pouches" width={340} height={117} />
          <div className="card-actions">
            <Button variant="secondary" onClick={onOpenPrepare}>
              Prepare more
            </Button>
            <Button onClick={onOpenRoutine}>View routine</Button>
          </div>
        </section>
        <h2 className="home-section-title">Records</h2>
        <div className="record-grid">
          <button type="button" onClick={() => onOpenRecords("prescriptions")}>
            <Image src="/assets/illustrations/prescriptions-record.png" alt="" width={100} height={100} />
            <span>Prescriptions</span>
          </button>
          <button type="button" onClick={() => onOpenRecords("stock")}>
            <Image src="/assets/illustrations/stock-record.png" alt="" width={100} height={100} />
            <span>Stock ({medicinesList.length})</span>
          </button>
        </div>
      </div>
      <button type="button" className="fab" onClick={onAddPrescription}>
        <Plus /> Add prescription
      </button>
    </main>
  );
}

export function QuietcareApp() {
  const [progress, setProgress] = useState(initialProgress);
  const [patientData, setPatientData] = useState<PatientProfile>(initialPatient);
  const [medicinesData, setMedicinesData] = useState<Medicine[]>(initialMedicinesList);
  const [prescriptionsData, setPrescriptionsData] = useState<PrescriptionRecord[]>([]);
  const [telegramData, setTelegramData] = useState<TelegramConnection>({
    connected: false,
    botHandle: "@QuietcareReminderBot",
    deepLink: "https://t.me/QuietcareReminderBot?start=qc_meena_7829",
  });
  const [serverLive, setServerLive] = useState(true);
  const [doseTaken, setDoseTaken] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);

  const [prescriptionModal, setPrescriptionModal] = useState(false);
  const [medicineModal, setMedicineModal] = useState(false);
  const [uploadModal, setUploadModal] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string>();

  const coverage = useMemo(() => calculateCoverage(medicinesData), [medicinesData]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage((prev) => (prev === msg ? null : prev)), 2800);
  };

  const refreshState = async () => {
    const state = await fetchAppState();
    if (state) {
      setServerLive(true);
      if (state.patient) setPatientData(state.patient);
      if (state.medicines && state.medicines.length > 0) setMedicinesData(state.medicines);
      if (state.prescriptions) setPrescriptionsData(state.prescriptions);
      if (state.telegram) setTelegramData(state.telegram);
    }
  };

  useEffect(() => {
    let active = true;
    fetchAppState().then((state) => {
      if (!active || !state) return;
      setServerLive(true);
      if (state.patient) setPatientData(state.patient);
      if (state.medicines && state.medicines.length > 0) setMedicinesData(state.medicines);
      if (state.prescriptions) setPrescriptionsData(state.prescriptions);
      if (state.telegram) setTelegramData(state.telegram);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleLogout = () => {
    try {
      localStorage.removeItem("quietcare_auth");
    } catch {
      // Ignore
    }
    setIsAuthenticated(false);
    showToast("Signed out of demo session");
  };

  useEffect(() => {
    const transitions: Partial<Record<FlowScreen, FlowScreen>> = {
      "prescription-loading": "prescription-review",
      "medicine-loading": "medicine-review",
      "routine-loading": "routine-ready",
      "routine-ready": "labels-choice",
      waiting: "connected",
    };
    const next = transitions[progress.screen];
    if (!next) return;
    const delay = progress.screen === "waiting" ? 2400 : 1400;
    const timer = window.setTimeout(() => setProgress((current) => ({ ...current, screen: next })), delay);
    return () => window.clearTimeout(timer);
  }, [progress.screen]);

  const go = (screen: FlowScreen) => setProgress((current) => ({ ...current, screen }));
  const back = () => go(backMap[progress.screen] ?? "welcome");

  const startNewPrescription = () => {
    setProgress({ ...initialProgress, screen: "prescription-upload" });
    setSelectedName(undefined);
  };

  const upload = async (file?: File) => {
    if (file) setSelectedName(file.name);
    const targetScreen =
      progress.screen === "prescription-upload"
        ? "prescription-loading"
        : "medicine-loading";
    go(targetScreen);

    if (progress.screen === "prescription-upload") {
      const res = await uploadPrescriptionFile(file);
      if (res.success && res.medicines) {
        setMedicinesData(res.medicines);
        showToast("Prescription analyzed by backend OCR");
      }
    }
  };

  const handleSaveTiming = async (timing: string) => {
    setProgress((prev) => ({ ...prev, timingConfirmed: true }));
    setPrescriptionModal(false);
    showToast(`Timing confirmed: ${timing}`);
    setMedicinesData((prev) =>
      prev.map((m) => (m.id === "vertin" ? { ...m, timing, uncertain: false } : m))
    );
    await updateMedicineTiming("vertin", timing, true);
  };

  const handleSaveQty = async (qty: number) => {
    setMedicineModal(false);
    showToast(`Saved quantity: ${qty} tablets`);
    setMedicinesData((prev) =>
      prev.map((m) => (m.id === "vertin" ? { ...m, quantity: qty } : m))
    );
    await updateMedicineQuantity("vertin", qty);
  };

  const handleCreateRoutine = async () => {
    go("routine-loading");
    const res = await saveRoutineSettings(
      progress.language,
      progress.breakfast,
      progress.dinner
    );
    if (res.success && res.coverageDays) {
      showToast(`Routine saved: ${res.coverageDays} days coverage`);
    }
  };

  const handleShareTelegram = async () => {
    go("waiting");
    await connectTelegram("create");
    showToast("Telegram connect link ready");
  };

  const handleFinishTelegram = async () => {
    await connectTelegram("confirm");
    setTelegramData((prev) => ({ ...prev, connected: true }));
    showToast("Telegram connected successfully!");
    go("home");
  };

  const handleSendTestReminder = async () => {
    const res = await connectTelegram("send_test_reminder");
    if (res.success) {
      showToast("Test dose reminder sent to Telegram!");
    }
  };

  const handleResetDatabase = async () => {
    try {
      const res = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      if (res.ok) {
        await refreshState();
        showToast("Backend database reset to defaults");
        setActiveDialog(null);
      }
    } catch {
      showToast("Reset completed");
    }
  };

  const handleShareLabels = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Quietcare Pouch Labels",
          text: `Prescription pouch labels for ${patientData.name}`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        showToast("Labels link copied to clipboard");
      }
    } catch {
      showToast("Labels link ready");
    }
  };

  const handleToggleDose = async () => {
    const next = !doseTaken;
    setDoseTaken(next);
    if (next) {
      showToast("✓ Marked Before Dinner dose as taken for Meena");
      try {
        await fetch("/api/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "dose_taken",
            patientId: "meena",
            details: { dose: "Before Dinner", time: "7:30 PM", recordedAt: new Date().toISOString() },
          }),
        });
      } catch (err) {
        console.error("Failed to log dose", err);
      }
    } else {
      showToast("Before Dinner dose marked as pending");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="app-shell">
        <LoginScreen
          serverLive={serverLive}
          onLoginSuccess={() => {
            setIsAuthenticated(true);
            setProgress((prev) => ({ ...prev, screen: "home" }));
            showToast("✓ Signed in successfully. Welcome to Quietcare!");
          }}
        />
        {toastMessage && (
          <div
            role="status"
            style={{
              position: "absolute",
              top: 50,
              left: 16,
              right: 16,
              background: "rgba(15, 23, 42, 0.95)",
              color: "white",
              padding: "10px 14px",
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 600,
              textAlign: "center",
              zIndex: 40,
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            }}
          >
            {toastMessage}
          </div>
        )}
      </div>
    );
  }

  if (progress.screen === "home") {
    return (
      <div className="app-shell app-shell--home">
        <StatusBar home serverLive={serverLive} />
        <HomeScreen
          patientData={patientData}
          medicinesList={medicinesData}
          doseTaken={doseTaken}
          onToggleDose={handleToggleDose}
          onAddPrescription={startNewPrescription}
          onOpenSetup={() => go("welcome")}
          onOpenReview={() => setActiveDialog("refill")}
          onOpenRoutine={() => setActiveDialog("routine")}
          onOpenPrepare={() => setActiveDialog("prepare")}
          onOpenRecords={(type) => setActiveDialog(type)}
          onOpenProfile={() => setActiveDialog("profile")}
          onLogout={handleLogout}
        />
        {activeDialog === "refill" && (
          <DetailModal title="Refill Alert" onClose={() => setActiveDialog(null)}>
            <p style={{ margin: "8px 0 12px", color: "var(--color-text-2)", fontSize: 13, lineHeight: "19px" }}>
              <strong>Telma 40mg</strong> currently has approximately 4 days of stock remaining.
            </p>
            <div style={{ background: "var(--color-surface)", padding: 12, borderRadius: 10, border: "1px solid var(--color-border-2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                <span>Daily Dosage:</span>
                <strong>1 tablet after food</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span>Suggested Reorder:</span>
                <strong>Strip of 15 tablets</strong>
              </div>
            </div>
          </DetailModal>
        )}
        {activeDialog === "routine" && (
          <DetailModal title={`${patientData.name}'s Routine`} onClose={() => setActiveDialog(null)}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
              <div style={{ padding: 12, borderRadius: 10, background: "var(--color-surface)", border: "1px solid var(--color-border-2)" }}>
                <strong style={{ display: "block", fontSize: 13, color: "var(--color-text)" }}>Morning ({progress.breakfast})</strong>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--color-text-2)" }}>
                  Glycomet 500mg (1 tab) • Vertin 2mg (1 tab) after breakfast
                </p>
              </div>
              <div style={{ padding: 12, borderRadius: 10, background: "var(--color-surface)", border: "1px solid var(--color-border-2)" }}>
                <strong style={{ display: "block", fontSize: 13, color: "var(--color-text)" }}>Night ({progress.dinner})</strong>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--color-text-2)" }}>
                  Telma 40mg (1 tab) • Pan 40mg (1 tab) after dinner
                </p>
              </div>
            </div>
          </DetailModal>
        )}
        {activeDialog === "prepare" && (
          <DetailModal title="Prepare Pouches" onClose={() => setActiveDialog(null)}>
            <p style={{ fontSize: 12, color: "var(--color-text-2)", lineHeight: "18px" }}>
              Organize individual medicine pouches with printed labels for each scheduled dose through {patientData.preparedThrough}.
            </p>
            <div style={{ marginTop: 12 }}>
              <Button
                variant="secondary"
                onClick={() => {
                  setActiveDialog(null);
                  go("labels");
                }}
              >
                View Printable Labels
              </Button>
            </div>
          </DetailModal>
        )}
        {activeDialog === "prescriptions" && (
          <DetailModal title="Prescription Records" onClose={() => setActiveDialog(null)}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              {prescriptionsData.length > 0 ? (
                prescriptionsData.map((rx) => (
                  <div key={rx.id} style={{ padding: 12, borderRadius: 10, background: "var(--color-surface)", border: "1px solid var(--color-border-2)" }}>
                    <strong style={{ fontSize: 12 }}>{rx.fileName}</strong>
                    <span style={{ display: "block", fontSize: 11, color: "var(--color-text-2)", marginTop: 2 }}>
                      {rx.doctorName || "Dr. S. Kulkarni"} • {rx.clinic || "Clinic"}
                    </span>
                    <span style={{ display: "block", fontSize: 10, color: "var(--color-text-3)", marginTop: 4 }}>
                      Status: {rx.status} • {rx.courseDays}-day course
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ padding: 12, borderRadius: 10, background: "var(--color-surface)", border: "1px solid var(--color-border-2)" }}>
                  <strong style={{ fontSize: 12 }}>{patientData.prescriptionName}</strong>
                  <span style={{ display: "block", fontSize: 11, color: "var(--color-text-2)", marginTop: 2 }}>
                    Dr. S. Kulkarni • Cardiology Clinic
                  </span>
                  <span style={{ display: "block", fontSize: 10, color: "var(--color-text-3)", marginTop: 4 }}>
                    Added recently • {patientData.courseDays}-day course
                  </span>
                </div>
              )}
            </div>
          </DetailModal>
        )}
        {activeDialog === "stock" && (
          <DetailModal title="Medicines Inventory" onClose={() => setActiveDialog(null)}>
            <p style={{ fontSize: 11, color: "var(--color-text-3)", margin: "4px 0 12px" }}>
              Live inventory synced with backend API:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {medicinesData.map((m) => (
                <div key={m.id} className="stock-row">
                  <div>
                    <strong style={{ display: "block", color: "var(--color-text)" }}>{m.name}</strong>
                    <span style={{ fontSize: 10, color: "var(--color-text-3)" }}>
                      {m.schedule} • {m.timing}
                    </span>
                  </div>
                  <div className="stock-counter">
                    <button
                      type="button"
                      className="stock-btn"
                      onClick={async () => {
                        const newQty = Math.max(0, m.quantity - 1);
                        setMedicinesData((prev) =>
                          prev.map((item) => (item.id === m.id ? { ...item, quantity: newQty } : item))
                        );
                        await updateMedicineQuantity(m.id, newQty);
                      }}
                      title="Decrease quantity"
                    >
                      -
                    </button>
                    <strong style={{ minWidth: 46, textAlign: "center" }}>
                      {m.quantity} tab{m.quantity === 1 ? "" : "s"}
                    </strong>
                    <button
                      type="button"
                      className="stock-btn"
                      onClick={async () => {
                        const newQty = m.quantity + 1;
                        setMedicinesData((prev) =>
                          prev.map((item) => (item.id === m.id ? { ...item, quantity: newQty } : item))
                        );
                        await updateMedicineQuantity(m.id, newQty);
                      }}
                      title="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </DetailModal>
        )}
        {activeDialog === "profile" && (
          <DetailModal title="Caregiver & Backend Settings" onClose={() => setActiveDialog(null)}>
            <div style={{ fontSize: 12, color: "var(--color-text-2)", display: "flex", flexDirection: "column", gap: 12, marginTop: 10 }}>
              <div>
                <span style={{ color: "var(--color-text-3)", display: "block", fontSize: 11 }}>Parent Name:</span>
                <strong style={{ color: "var(--color-text)", fontSize: 14 }}>{patientData.name}</strong>
              </div>
              <div>
                <span style={{ color: "var(--color-text-3)", display: "block", fontSize: 11 }}>Language Preference:</span>
                <strong style={{ color: "var(--color-text)" }}>{progress.language}</strong>
              </div>
              <div>
                <span style={{ color: "var(--color-text-3)", display: "block", fontSize: 11 }}>Scheduled Meal Times:</span>
                <strong style={{ color: "var(--color-text)" }}>Breakfast: {progress.breakfast} | Dinner: {progress.dinner}</strong>
              </div>
              <div>
                <span style={{ color: "var(--color-text-3)", display: "block", fontSize: 11 }}>Telegram Connection:</span>
                <strong style={{ color: telegramData.connected ? "#10b981" : "#f59e0b" }}>
                  {telegramData.connected ? "Active & Linked" : "Pending setup"} ({telegramData.botHandle})
                </strong>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                <Button variant="secondary" onClick={handleSendTestReminder}>
                  Send Test Telegram Reminder
                </Button>
                <Button variant="danger" onClick={handleResetDatabase}>
                  Reset Backend State to Default
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setActiveDialog(null);
                    handleLogout();
                  }}
                  style={{ borderColor: "#fca5a5", color: "#dc2626" }}
                >
                  Sign Out (Demo Session)
                </Button>
              </div>
            </div>
          </DetailModal>
        )}
      </div>
    );
  }

  let content: React.ReactNode;
  switch (progress.screen) {
    case "welcome":
      content = (
        <main className="welcome-screen">
          <div className="nav-pill-group" style={{ margin: "0 0 12px" }}>
            <button type="button" className="nav-pill" onClick={() => go("home")}>
              Meena&apos;s Routine
            </button>
            <button type="button" className="nav-pill nav-pill--active">
              Setup Walkthrough
            </button>
            <button type="button" className="nav-pill" onClick={handleLogout} title="Open Demo Login Page">
              Demo Login
            </button>
          </div>
          <div className="welcome-photo">
            <Image src="/assets/images/welcome-caregiver.png" alt="A caregiver and her parent reviewing medicine information" fill priority sizes="342px" />
          </div>
          <div className="brand-mark">
            <Image src="/assets/brand/quietcare-logo.png" alt="Quietcare" width={94} height={94} priority />
          </div>
          <div className="welcome-copy">
            <h1>Welcome to Quietcare</h1>
            <p>
              Turn your parent&apos;s prescription and available
              <br />
              medicines into a clear routine.
            </p>
          </div>
          <Bottom>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <Button onClick={() => go("home")}>
                View Meena&apos;s Routine (Dashboard)
              </Button>
              <Button variant="secondary" onClick={() => go("prescription-upload")}>
                + Set Up New Prescription
              </Button>
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "#64748b",
                  fontSize: 11,
                  padding: "4px 0",
                  cursor: "pointer",
                  textAlign: "center",
                  textDecoration: "underline",
                }}
              >
                Sign out of demo session
              </button>
            </div>
          </Bottom>
        </main>
      );
      break;
    case "prescription-upload":
      content = (
        <main className="screen-content">
          <h1>
            Upload photos of their
            <br />
            prescription
          </h1>
          <p>We&apos;ll read it and build a clear medicine routine for your parent.</p>
          <CaptureArt kind="prescription" />
          <UploadActions
            selectedName={selectedName}
            onChoose={() => setUploadModal(true)}
            onTake={() => upload()}
          />
        </main>
      );
      break;
    case "prescription-loading":
      content = <LoadingScreen title="Reading your prescription" detail="Finding medicine names, doses and timings with Gemini AI…" />;
      break;
    case "prescription-review":
      content = (
        <PrescriptionReview
          timingConfirmed={progress.timingConfirmed}
          medicinesList={medicinesData}
          patientName={patientData.prescriptionName}
          courseDays={patientData.courseDays}
          onEdit={() => setPrescriptionModal(true)}
          onExpand={() => setLightboxSrc("/assets/images/prescription.png")}
          onContinue={() => go("medicine-upload")}
        />
      );
      break;
    case "medicine-upload":
      content = (
        <main className="screen-content">
          <h1>Add a photo of the medicines</h1>
          <p>We&apos;ll match them to the prescription and show how many doses can be prepared.</p>
          <CaptureArt kind="medicine" />
          <ul className="capture-tips">
            {["Place medicines on a flat surface", "Keep names facing up", "Avoid overlapping packages", "Use good lighting"].map((tip) => (
              <li key={tip}>
                <span>
                  <Check size={11} />
                </span>
                {tip}
              </li>
            ))}
          </ul>
          <UploadActions onChoose={() => setUploadModal(true)} onTake={() => upload()} />
        </main>
      );
      break;
    case "medicine-loading":
      content = <LoadingScreen title="Matching medicines" detail="Comparing the medicines with the prescription…" />;
      break;
    case "medicine-review":
      content = <MedicineReview onEdit={() => setMedicineModal(true)} onContinue={() => go("personalise")} />;
      break;
    case "personalise":
      content = (
        <main className="screen-content">
          <h1>
            Personalise your parent&apos;s
            <br />
            routine
          </h1>
          <p>We&apos;ll use these details for their medicine reminders.</p>
          <div className="form-stack">
            <label>
              Preferred language
              <select value={progress.language} onChange={(event) => setProgress({ ...progress, language: event.target.value })}>
                {languages.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>Usual meal times</legend>
              <label>
                Breakfast
                <select value={progress.breakfast} onChange={(event) => setProgress({ ...progress, breakfast: event.target.value })}>
                  {mealTimes.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                Dinner
                <select value={progress.dinner} onChange={(event) => setProgress({ ...progress, dinner: event.target.value })}>
                  {dinnerTimes.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            </fieldset>
          </div>
          <Bottom>
            <Button onClick={handleCreateRoutine}>Create Routine</Button>
          </Bottom>
        </main>
      );
      break;
    case "routine-loading":
      content = <LoadingScreen title="Creating your routine" detail="Calculating doses and available days…" />;
      break;
    case "routine-ready":
      content = (
        <main className="center-screen">
          <span className="success-check">
            <Check size={30} />
          </span>
          <h1>Your routine is ready</h1>
          <p>The available medicines will cover {coverage} days.</p>
        </main>
      );
      break;
    case "labels-choice":
      content = (
        <main className="screen-content">
          <h1>
            Would you like to prepare
            <br />
            labelled medicine pouches?
          </h1>
          <p>Each pouch shows what your parent takes and when. We&apos;ll create the labels and guide you through packing.</p>
          <div className="choice-illustration">
            <Image src="/assets/illustrations/label-choice.png" alt="A hand placing a label on a medicine pouch" width={310} height={326} />
          </div>
          <Bottom>
            <div className="split-actions">
              <Button variant="secondary" onClick={() => go("connect")}>
                Skip
              </Button>
              <Button onClick={() => go("labels")}>Yes, create labels</Button>
            </div>
          </Bottom>
        </main>
      );
      break;
    case "labels":
      content = (
        <main className="screen-content">
          <h1>Prepare the medicine pouches</h1>
          <p>Print these labels, cut them out and stick one on each pouch. Then return here to continue</p>
          <LabelsPreview />
          <Bottom>
            <div className="split-actions">
              <Button variant="secondary" onClick={handleShareLabels}>
                <Share size={20} /> Share
              </Button>
              <Button
                onClick={() => {
                  showToast("Opening packing view...");
                  go("pack");
                }}
              >
                <Download size={20} /> Download pdf
              </Button>
            </div>
          </Bottom>
        </main>
      );
      break;
    case "pack":
      content = (
        <main className="screen-content pack-screen">
          <h1>Pack medicines</h1>
          <p>Find the highlighted medicine in your photo, then add the shown amount.</p>
          <div className="pack-photo">
            <Image src="/assets/images/medicines-highlighted.png" alt="Highlighted medicine packages" fill sizes="390px" />
          </div>
          <div className="packet-summary">
            <Image src="/assets/pouch-labels/before-breakfast.png" alt="Before breakfast pouch label" width={70} height={86} />
            <p>
              Packet 1<strong>Before breakfast</strong>
            </p>
          </div>
          <div className="packing-row">
            <b>1</b>
            <span>
              Glycomet 500mg<strong>Cut 7 sealed tablets</strong>
            </span>
          </div>
          <div className="packing-row">
            <b>2</b>
            <span>
              Cholecalciferol<strong>Cut 7 sealed tablets</strong>
            </span>
          </div>
          <Bottom>
            <Button onClick={() => go("connect")}>Next round</Button>
          </Bottom>
        </main>
      );
      break;
    case "connect":
      content = (
        <main className="screen-content">
          <h1>
            Connect your parent on
            <br />
            Telegram
          </h1>
          <p>Send them a secure link. They must open it and tap Start before reminders can begin.</p>
          <div className="telegram-illustration">
            <Image src="/assets/illustrations/telegram-connect.png" alt="Telegram connection illustration" fill sizes="342px" />
          </div>
          <ul className="capture-tips connect-steps">
            {["Share the Telegram link", "Your parent taps Start", "Medicine reminders begin"].map((step) => (
              <li key={step}>
                <span>
                  <Check size={11} />
                </span>
                {step}
              </li>
            ))}
          </ul>
          <Bottom>
            <Button onClick={handleShareTelegram}>Share Telegram link</Button>
          </Bottom>
        </main>
      );
      break;
    case "waiting":
      content = (
        <main className="screen-content">
          <h1>Waiting for your parent</h1>
          <p>We&apos;ll let you know when they open Telegram and tap Start.</p>
          <div className="telegram-illustration">
            <Image src="/assets/illustrations/telegram-waiting.png" alt="Waiting for Telegram connection" fill sizes="342px" />
          </div>
        </main>
      );
      break;
    case "connected":
      content = (
        <main className="screen-content">
          <h1>Your parent is connected</h1>
          <p>Medicine reminders will begin with their next scheduled dose.</p>
          <div className="telegram-illustration">
            <Image src="/assets/illustrations/telegram-connected.png" alt="Telegram successfully connected" fill sizes="342px" />
          </div>
          <Bottom>
            <Button onClick={handleFinishTelegram}>Finish Setup</Button>
          </Bottom>
        </main>
      );
      break;
  }

  return (
    <div className="app-shell">
      <StatusBar />
      <FlowHeader screen={progress.screen} onBack={back} onExit={() => go("home")} />
      {content}
      {toastMessage && (
        <div
          role="status"
          style={{
            position: "absolute",
            top: 50,
            left: 16,
            right: 16,
            background: "rgba(15, 23, 42, 0.95)",
            color: "white",
            padding: "10px 14px",
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 600,
            textAlign: "center",
            zIndex: 40,
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          }}
        >
          {toastMessage}
        </div>
      )}
      {prescriptionModal && (
        <EditPrescription
          onClose={() => setPrescriptionModal(false)}
          onSave={handleSaveTiming}
        />
      )}
      {medicineModal && (
        <EditMedicine
          onClose={() => setMedicineModal(false)}
          onSave={handleSaveQty}
        />
      )}
      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt="Prescription document"
          onClose={() => setLightboxSrc(null)}
        />
      )}
      {uploadModal && (
        <UploadModal
          medicine={progress.screen === "medicine-upload"}
          onClose={() => setUploadModal(false)}
          onSelect={(file) => {
            setUploadModal(false);
            upload(file);
          }}
        />
      )}
    </div>
  );
}
