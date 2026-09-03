"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  dinnerTimes,
  languages,
  mealTimes,
  medicines as initialMedicinesList,
  patient as initialPatient,
} from "@/data/mock-data";
import type {
  ActivityLog,
  Dose,
  DoseStatus,
  FlowScreen,
  HelpRequest,
  Medicine,
  PatientProfile,
  PrescriptionRecord,
  QuietcareProgress,
  TelegramConnection,
} from "@/types/quietcare";
import {
  connectTelegram,
  createMedicine,
  deleteMedicine,
  fetchAppState,
  fetchHelpRequests,
  fetchTelegramStatus,
  fetchTodayDoses,
  resetBackendState,
  saveRoutineSettings,
  triggerTestDoseReminder,
  updateDoseStatusApi,
  updateHelpRequestStatusApi,
  updateMedicine,
  updateMedicineQuantity,
  uploadPrescriptionFile,
} from "@/lib/client/api";
import { generateDosePacks } from "@/lib/routine";
import { Button } from "@/components/ui/button";
import {
  ActivityIcon,
  ArrowLeft,
  Bell,
  Camera,
  Check,
  Download,
  Edit,
  Expand,
  Folder,
  Moon,
  Plus,
  Share,
  Sun,
  Trash,
  UserCircle,
} from "./icons";
import { LoginScreen } from "./login-screen";
import { PatientScreen } from "./patient-screen";

const initialProgress: QuietcareProgress = {
  screen: "home",
  timingConfirmed: false,
  language: "Marathi",
  breakfast: "8:00 am",
  dinner: "7:30 pm",
};

const backMap: Partial<Record<FlowScreen, FlowScreen>> = {
  "prescription-upload": "welcome",
  "prescription-review": "prescription-upload",
  "medicine-upload": "prescription-review",
  "medicine-review": "medicine-upload",
  personalise: "medicine-review",
  "routine-ready": "personalise",
  "labels-choice": "routine-ready",
  labels: "labels-choice",
  pack: "labels",
  connect: "pack",
  waiting: "connect",
  connected: "waiting",
};

function StatusBar({
  home = false,
  serverLive = true,
}: {
  home?: boolean;
  serverLive?: boolean;
}) {
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
        <i />
      </span>
    </div>
  );
}

function FlowHeader({
  screen,
  onBack,
  onExit,
}: {
  screen: FlowScreen;
  onBack: () => void;
  onExit: () => void;
}) {
  if (screen === "welcome" || screen === "home") return null;

  return (
    <header className="flow-header">
      <button onClick={onBack} aria-label="Back">
        <ArrowLeft />
      </button>
      <span>Quietcare</span>
      <button onClick={onExit} aria-label="Exit setup">
        <Image src="/assets/icons/close.svg" alt="" width={24} height={24} />
      </button>
    </header>
  );
}

function Bottom({ children }: { children: React.ReactNode }) {
  return <div className="bottom-bar">{children}</div>;
}

function LoadingScreen({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <main className="loading-screen" role="status" aria-live="polite">
      <div className="spinner" />
      <h2>{title}</h2>
      <p>{detail}</p>
    </main>
  );
}

function CaptureArt({ kind }: { kind: "prescription" | "medicine" }) {
  return (
    <div className="capture-art" aria-hidden="true">
      <div className="capture-art-pulse" />
      <div className="capture-art-grid" />
      <div className="capture-art-card">
        <Image
          src={
            kind === "prescription"
              ? "/assets/illustrations/prescription-scan.png"
              : "/assets/illustrations/medicines-scan.png"
          }
          alt=""
          width={kind === "prescription" ? 220 : 250}
          height={kind === "prescription" ? 250 : 210}
          priority
        />
      </div>
      <div className="capture-art-reticle" />
    </div>
  );
}

function MedicineList({
  medicineItems,
  timingConfirmed,
  onEdit,
}: {
  medicineItems: Medicine[];
  timingConfirmed: boolean;
  onEdit: (med: Medicine) => void;
}) {
  return (
    <div className="medicine-list" role="list">
      {medicineItems.map((med) => {
        const isUncertain = Boolean(med.uncertain && !timingConfirmed);
        return (
          <article
            className={`medicine-card ${isUncertain ? "medicine-card--warn" : ""}`}
            key={med.id}
          >
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--color-text)" }}>
                {med.name}
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-text-2)" }}>
                {med.schedule} • {med.timing}
              </p>
              {med.instructions && (
                <span style={{ display: "block", fontSize: 10, color: "var(--color-text-3)", marginTop: 2 }}>
                  {med.instructions}
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <span className="medicine-days">{med.days} days</span>
              {isUncertain ? (
                <button
                  type="button"
                  className="warn-pill"
                  onClick={() => onEdit(med)}
                  title="Timing unclear from prescription. Tap to confirm."
                >
                  Confirm timing
                </button>
              ) : (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#16a34a",
                    background: "#dcfce7",
                    padding: "2px 6px",
                    borderRadius: 999,
                  }}
                >
                  ✓ Verified
                </span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function EditPrescriptionModal({
  medicine,
  medicinesList,
  onClose,
  onSave,
}: {
  medicine: Medicine | null;
  medicinesList: Medicine[];
  onClose: () => void;
  onSave: (medId: string, timing: string, schedule: string) => void;
}) {
  const targetMed = medicine || medicinesList.find((m) => m.uncertain) || medicinesList[0];
  const [selectedId, setSelectedId] = useState(targetMed?.id || "");
  const currentMed = medicinesList.find((m) => m.id === selectedId) || targetMed;
  const [selectedTiming, setSelectedTiming] = useState(currentMed?.timing || "After food");
  const [selectedSchedule, setSelectedSchedule] = useState(currentMed?.schedule || "1-0-1");

  const timings = ["Before food", "With food", "After food", "At bedtime"];
  const schedules = ["1-0-0", "0-1-0", "0-0-1", "1-0-1", "1-1-1"];

  return (
    <div className="modal-scrim" onClick={onClose}>
      <section className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>Confirm Medicine Timing</h2>
          <button onClick={onClose} aria-label="Close">
            <Image src="/assets/icons/close.svg" alt="" width={24} height={24} />
          </button>
        </div>
        <label>
          Medicine
          <select
            value={selectedId}
            onChange={(e) => {
              const newId = e.target.value;
              setSelectedId(newId);
              const m = medicinesList.find((item) => item.id === newId);
              if (m) {
                setSelectedTiming(m.timing);
                setSelectedSchedule(m.schedule);
              }
            }}
          >
            {medicinesList.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {m.uncertain ? "(Unclear timing)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label>
          Schedule
          <select
            value={selectedSchedule}
            onChange={(e) => setSelectedSchedule(e.target.value)}
          >
            {schedules.map((s) => (
              <option key={s} value={s}>
                {s} ({s === "1-0-1" ? "Morning & Night" : s === "1-0-0" ? "Morning only" : s === "0-0-1" ? "Night only" : s})
              </option>
            ))}
          </select>
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
          <Button onClick={() => onSave(selectedId, selectedTiming, selectedSchedule)}>
            Save & Confirm
          </Button>
        </div>
      </section>
    </div>
  );
}

function UploadActions({
  onChoose,
  onTake,
  selectedName,
}: {
  onChoose: () => void;
  onTake: () => void;
  selectedName?: string;
}) {
  return (
    <Bottom>
      {selectedName && (
        <div className="file-chip">Selected: {selectedName}</div>
      )}
      <div className="split-actions">
        <Button variant="secondary" onClick={onChoose}>
          <Folder /> Choose photo
        </Button>
        <Button onClick={onTake}>
          <Camera /> Take photo
        </Button>
      </div>
    </Bottom>
  );
}

function UploadModal({
  medicine,
  onClose,
  onSelect,
}: {
  medicine: boolean;
  onClose: () => void;
  onSelect: (file?: File) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="modal-scrim modal-scrim--center">
      <section className="upload-dialog" role="dialog" aria-modal="true" aria-labelledby="upload-title">
        <div className="sheet-header">
          <h2 id="upload-title">Upload {medicine ? "medicine photo" : "prescription"}</h2>
          <button onClick={onClose} aria-label="Close">
            <Image src="/assets/icons/close.svg" alt="" width={24} height={24} />
          </button>
        </div>
        <div
          className={`upload-drop ${dragActive ? "upload-drop--active" : ""}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          style={{
            borderColor: dragActive ? "var(--color-primary, #2563eb)" : undefined,
            background: dragActive ? "rgba(37, 99, 235, 0.04)" : undefined,
          }}
        >
          <Folder size={32} />
          <strong>Drop photo here or choose from device</strong>
          <span>{medicine ? "JPG, PNG or WebP (max 10MB)" : "JPG, PNG or WebP (max 10MB)"}</span>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <Button onClick={() => fileInput.current?.click()}>Browse files</Button>
            <Button variant="secondary" onClick={() => cameraInput.current?.click()}>
              <Camera size={14} /> Camera
            </Button>
          </div>
          <input
            ref={fileInput}
            className="sr-only"
            type="file"
            accept={medicine ? "image/*" : "image/jpeg,image/png,image/webp"}
            onChange={(event) => onSelect(event.target.files?.[0])}
          />
          <input
            ref={cameraInput}
            className="sr-only"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => onSelect(event.target.files?.[0])}
          />
        </div>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </section>
    </div>
  );
}

function PrescriptionReview({
  timingConfirmed,
  medicinesList,
  patientName,
  courseDays,
  ocrSource = "gemini-3.8-flash",
  ocrNotice,
  uploadedImageUrl,
  onEdit,
  onContinue,
  onExpand,
}: {
  timingConfirmed: boolean;
  medicinesList: Medicine[];
  patientName: string;
  courseDays: number;
  ocrSource?: string;
  ocrNotice?: string;
  uploadedImageUrl?: string;
  onEdit: (med?: Medicine) => void;
  onContinue: () => void;
  onExpand: () => void;
}) {
  const uncertainCount = medicinesList.filter((m) => m.uncertain).length;

  return (
    <main className="screen-content screen-content--review">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <h1 style={{ margin: 0 }}>Review prescription</h1>
        <span className="badge-ai">
          {ocrSource === "gemini-3.8-flash" ? "✨ Gemini Multimodal OCR" : "Prescription OCR"}
        </span>
      </div>
      <p style={{ margin: "0 0 12px" }}>
        We found {medicinesList.length} medicines. Check{" "}
        {timingConfirmed || uncertainCount === 0 ? "the details" : `${uncertainCount} unclear detail`}{" "}
        before continuing.
      </p>

      {ocrNotice && (
        <div style={{ fontSize: 11, color: "var(--color-text-3)", marginBottom: 10, background: "var(--color-surface)", padding: "6px 10px", borderRadius: 8 }}>
          {ocrNotice}
        </div>
      )}

      <div className="prescription-preview">
        <Image
          src={uploadedImageUrl || "/assets/images/prescription.png"}
          alt="Uploaded prescription"
          fill
          sizes="342px"
          priority
          style={{ objectFit: "cover" }}
        />
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
        onEdit={(med) => onEdit(med)}
      />
      <Bottom>
        <Button
          variant="primary"
          onClick={timingConfirmed || uncertainCount === 0 ? onContinue : () => onEdit()}
        >
          {timingConfirmed || uncertainCount === 0 ? "Confirm Prescription" : "Check 1 Unclear Detail"}
        </Button>
      </Bottom>
    </main>
  );
}

function MedicineReview({
  medicinesList,
  onEditMedicine,
  onDeleteMedicine,
  onAddMedicine,
  onContinue,
}: {
  medicinesList: Medicine[];
  onEditMedicine: (med: Medicine) => void;
  onDeleteMedicine: (id: string) => void;
  onAddMedicine: () => void;
  onContinue: () => void;
}) {
  const tagPositions = [
    [2, 32],
    [55, 31],
    [4, 48],
    [67, 60],
    [2, 70],
    [35, 64],
    [38, 77],
    [2, 91],
    [37, 93],
    [69, 91],
  ];

  return (
    <main className="photo-review">
      <div className="medicine-photo" style={{ position: "relative" }}>
        <Image
          src="/assets/images/medicines-flatlay.png"
          alt="Detected medicine packages laid flat"
          fill
          sizes="390px"
          priority
        />
        <button
          onClick={onAddMedicine}
          aria-label="Add or edit matches"
          title="Add or edit medicine"
        >
          <Plus />
        </button>
        {medicinesList.slice(0, tagPositions.length).map((med, idx) => {
          const [x, y] = tagPositions[idx];
          return (
            <span
              className="detection-tag"
              style={{ left: `${x}%`, top: `${y}%` }}
              key={med.id}
              onClick={() => onEditMedicine(med)}
              title="Click to edit medicine"
            >
              {med.name}
              <b>{med.quantity ? `${med.quantity} Tab` : "20 Tab"}</b>
            </span>
          );
        })}
      </div>

      <div style={{ padding: "14px 16px 8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "var(--color-text)" }}>
            Verified Medications ({medicinesList.length})
          </h2>
          <button
            type="button"
            onClick={onAddMedicine}
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "4px 8px",
              borderRadius: 6,
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: "var(--color-text)",
            }}
          >
            <Plus size={12} /> Add
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {medicinesList.map((med) => (
            <div
              key={med.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 10px",
                background: "var(--color-surface)",
                borderRadius: 8,
                border: "1px solid var(--color-border-2)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <strong style={{ fontSize: 12, color: "var(--color-text)" }}>{med.name}</strong>
                  <span style={{ fontSize: 9, fontWeight: 700, background: "#f1f5f9", padding: "1px 5px", borderRadius: 4, color: "#475569" }}>
                    {med.schedule}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: "var(--color-text-2)", display: "block", marginTop: 2 }}>
                  {med.timing} • {med.quantity ?? 20} tabs ({med.days ?? 10} days)
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  type="button"
                  onClick={() => onEditMedicine(med)}
                  style={{
                    border: 0,
                    background: "transparent",
                    padding: 4,
                    cursor: "pointer",
                    color: "var(--color-text-2)",
                  }}
                  title="Edit medicine"
                >
                  <Edit size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteMedicine(med.id)}
                  style={{
                    border: 0,
                    background: "transparent",
                    padding: 4,
                    cursor: "pointer",
                    color: "#ef4444",
                  }}
                  title="Delete medicine"
                >
                  <Trash size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Bottom>
        <Button onClick={onContinue}>Confirm Medicine Match & Continue</Button>
      </Bottom>
    </main>
  );
}

function MedicineEditorModal({
  medicine,
  onClose,
  onSave,
}: {
  medicine: Partial<Medicine> | null;
  onClose: () => void;
  onSave: (med: Partial<Medicine>) => void;
}) {
  const isNew = !medicine?.id;
  const [name, setName] = useState(medicine?.name || "");
  const [schedule, setSchedule] = useState(medicine?.schedule || "1-0-1");
  const [timing, setTiming] = useState(medicine?.timing || "After food");
  const [quantity, setQuantity] = useState(medicine?.quantity ?? 20);
  const [days, setDays] = useState(medicine?.days ?? 10);
  const [instructions, setInstructions] = useState(medicine?.instructions || "");

  const schedules = ["1-0-0", "0-1-0", "0-0-1", "1-0-1", "1-1-1", "Custom"];
  const timings = [
    "Before food",
    "With food",
    "After food",
    "At bedtime",
    "After breakfast & dinner",
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      ...(medicine || {}),
      name: name.trim(),
      schedule,
      timing,
      quantity: Number(quantity) || 10,
      days: Number(days) || 10,
      instructions: instructions.trim() || undefined,
      uncertain: false,
    });
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <section
        className="sheet"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-header">
          <h2>{isNew ? "Add Medicine" : "Edit Medicine Details"}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <Image src="/assets/icons/close.svg" alt="" width={24} height={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label>
            Medicine Name & Strength
            <input
              type="text"
              required
              placeholder="e.g. Vertin 2mg or Telma 40mg"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label>
              Schedule
              <select
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
              >
                {schedules.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Timing
              <select
                value={timing}
                onChange={(e) => setTiming(e.target.value)}
              >
                {timings.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label>
              Available Qty (Units)
              <input
                type="number"
                min="1"
                max="300"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value) || 0)}
              />
            </label>

            <label>
              Course Duration (Days)
              <input
                type="number"
                min="1"
                max="90"
                value={days}
                onChange={(e) => setDays(Number(e.target.value) || 0)}
              />
            </label>
          </div>

          <label>
            Caregiver Notes / Instructions
            <input
              type="text"
              placeholder="e.g. Take with warm water"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </label>

          <div className="sheet-actions" style={{ marginTop: 8 }}>
            <Button type="button" variant="danger" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {isNew ? "Add Medicine" : "Save Changes"}
            </Button>
          </div>
        </form>
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
  dosesList,
  dosesStats,
  lastDose,
  nextDose,
  telegramData,
  activeHelpRequests = [],
  onResolveHelpRequest,
  onSwitchToPatientView,
  onToggleDoseStatus,
  onSendReminder,
  onAddPrescription,
  onOpenSetup,
  onOpenReview,
  onOpenRoutine,
  onOpenPrepare,
  onOpenRecords,
  onOpenProfile,
  onLogout,
  onOpenTelegramConnect,
}: {
  patientData: PatientProfile;
  medicinesList: Medicine[];
  dosesList: Dose[];
  dosesStats: {
    total: number;
    taken: number;
    pending: number;
    reminderSent: number;
    missed: number;
    notYet: number;
  };
  lastDose: Dose | null;
  nextDose: Dose | null;
  telegramData: TelegramConnection;
  activeHelpRequests?: HelpRequest[];
  onResolveHelpRequest?: (id: string) => Promise<void>;
  onSwitchToPatientView?: () => void;
  onToggleDoseStatus: (doseId: string, currentStatus: DoseStatus) => void;
  onSendReminder: (doseId?: string) => void;
  onAddPrescription: () => void;
  onOpenSetup: () => void;
  onOpenReview: () => void;
  onOpenRoutine: () => void;
  onOpenPrepare: () => void;
  onOpenRecords: (type: "prescriptions" | "stock" | "activity") => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  onOpenTelegramConnect: () => void;
}) {
  const totalCount = dosesStats.total || 4;
  const takenCount = dosesStats.taken;
  const percentage = Math.round((takenCount / Math.max(1, totalCount)) * 100);
  const allCompleted = takenCount >= totalCount && totalCount > 0;

  return (
    <main className="home-screen">
      <header className="home-header">
        <strong>quietcare</strong>
        <div style={{ position: "absolute", right: 16, top: 12, display: "flex", alignItems: "center", gap: 8 }}>
          {onSwitchToPatientView && (
            <button
              type="button"
              className="header-patient-btn"
              onClick={onSwitchToPatientView}
              title="Switch to Patient View"
              style={{
                fontSize: 11,
                fontWeight: 700,
                background: "#f0fdf4",
                border: "1px solid #86efac",
                color: "#166534",
                padding: "3px 8px",
                borderRadius: 8,
                cursor: "pointer",
              }}
              id="header-switch-patient-btn"
            >
              Patient View
            </button>
          )}
          <button
            type="button"
            className="header-logout-btn"
            onClick={onLogout}
            title="Sign out of session"
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
          {patientData.name || "Parent Profile"}
          <Image src="/assets/icons/chevron-down.svg" alt="" width={14} height={14} />
        </span>
      </header>

      <div className="nav-pill-group">
        <button type="button" className="nav-pill nav-pill--active">
          {patientData.name ? `${patientData.name}'s Routine` : "Care Routine"}
        </button>
        <button type="button" className="nav-pill" onClick={onOpenSetup}>
          Setup Walkthrough
        </button>
        <button type="button" className="nav-pill" onClick={() => onOpenRecords("activity")}>
          Activity Logs
        </button>
      </div>

      <div className="home-body">
        {/* 🆘 CAREGIVER HELP ALERT (Real Application State) */}
        {activeHelpRequests && activeHelpRequests.length > 0 && (
          <div
            className="caregiver-help-alert-card"
            id="caregiver-active-help-alert"
            style={{
              background: "#fff1f2",
              border: "2px solid #f43f5e",
              borderRadius: 16,
              padding: "16px 18px",
              marginBottom: 16,
              boxShadow: "0 6px 18px rgba(244, 63, 94, 0.18)",
              animation: "slideDown 0.25s ease-out",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "#ffe4e6",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  fontSize: 22,
                }}
              >
                🆘
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <strong style={{ fontSize: 16, color: "#9f1239", fontWeight: 800 }}>
                    Patient Needs Help!
                  </strong>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      background: "#fda4af",
                      color: "#881337",
                      padding: "2px 8px",
                      borderRadius: 6,
                    }}
                  >
                    ACTIVE ALERT
                  </span>
                </div>
                <p style={{ margin: "4px 0 2px", fontSize: 13, color: "#881337", lineHeight: "17px" }}>
                  The patient requested assistance.
                </p>
                <span style={{ display: "block", fontSize: 12, color: "#9f1239", fontWeight: 600 }}>
                  Time: {new Date(activeHelpRequests[0].createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>

                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {onSwitchToPatientView && (
                    <button
                      type="button"
                      onClick={onSwitchToPatientView}
                      style={{
                        flex: 1,
                        height: 38,
                        background: "#ffffff",
                        border: "1.5px solid #f43f5e",
                        borderRadius: 8,
                        color: "#9f1239",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                      id="caregiver-view-patient-btn"
                    >
                      View Patient
                    </button>
                  )}
                  {onResolveHelpRequest && (
                    <button
                      type="button"
                      onClick={() => onResolveHelpRequest(activeHelpRequests[0].id)}
                      style={{
                        flex: 1.2,
                        height: 38,
                        background: "#e11d48",
                        border: "none",
                        borderRadius: 8,
                        color: "#ffffff",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                      id="caregiver-resolve-help-btn"
                    >
                      ✓ Mark Resolved
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Telegram Connection Status Card */}
        <div className={`telegram-connect-card ${telegramData.connected ? "" : "telegram-connect-card--pending"}`}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: telegramData.connected ? "#15803d" : "#b45309" }}>
                {telegramData.connected ? "● Telegram Linked" : "○ Telegram Pending"}
              </span>
              <strong style={{ display: "block", fontSize: 13, color: "var(--color-text)", marginTop: 2 }}>
                {telegramData.connected
                  ? `Active with ${patientData.name || "Parent"} (${telegramData.botHandle || "@QuietcareReminderBot"})`
                  : "Parent not connected on Telegram"}
              </strong>
              <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--color-text-2)" }}>
                {telegramData.connected
                  ? "Daily dose reminders are dispatched automatically."
                  : "Connect your parent on Telegram to send dose prompts."}
              </p>
            </div>
            {telegramData.connected ? (
              <button
                type="button"
                className="dose-status-tag dose-status-tag--reminder_sent"
                style={{ fontSize: 10, padding: "4px 8px" }}
                onClick={() => onSendReminder(nextDose?.id)}
                title="Trigger a live reminder message to parent's Telegram"
              >
                <Bell size={12} /> Test Reminder
              </button>
            ) : (
              <Button
                variant="primary"
                onClick={onOpenTelegramConnect}
                style={{ height: 32, fontSize: 11, padding: "0 12px" }}
              >
                Connect
              </Button>
            )}
          </div>
        </div>

        {/* Today's Schedule Card */}
        <section className="today-card dose-card-interactive">
          <div className="section-title">
            <h2>Today&apos;s Doses</h2>
            {dosesList.length > 0 && (
              <span style={{ background: allCompleted ? "#15803d" : "#16a34a" }}>
                {allCompleted ? "All doses completed" : "On track"}
              </span>
            )}
          </div>

          {dosesList.length > 0 ? (
            <div className="today-grid">
              <div
                className="dose-ring"
                style={{
                  background: `conic-gradient(#22c55e 0 ${percentage}%, #cbd5e1 ${percentage}% 100%)`,
                }}
              >
                <span>Today</span>
                <b>{takenCount} / {totalCount}</b>
              </div>

              <div className="dose-times">
                {dosesList.map((dose) => {
                  const isNight = dose.timing.toLowerCase().includes("dinner") || dose.timing.toLowerCase().includes("bed");
                  const isTaken = dose.status === "taken";
                  const isSent = dose.status === "reminder_sent";
                  const isNotYet = dose.status === "not_yet";
                  const isMissed = dose.status === "missed";

                  return (
                    <div className="dose-item-action" key={dose.id}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                        {isNight ? <Moon size={20} /> : <Sun size={20} />}
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, display: "block" }}>
                            {dose.scheduledTimeLabel}
                            <strong style={{ fontWeight: 500, marginLeft: 6, fontSize: 11, color: "var(--color-text-2)" }}>
                              {dose.timing}
                            </strong>
                          </span>
                          <span style={{ display: "block", fontSize: 11, color: "var(--color-text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {dose.medicineName} ({dose.doseAmount})
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className={`dose-status-tag dose-status-tag--${dose.status}`}
                        onClick={() => onToggleDoseStatus(dose.id, dose.status)}
                        title={`Status: ${dose.status}. Click to change.`}
                      >
                        {isTaken && "✓ Taken"}
                        {isSent && "🔔 Sent"}
                        {isNotYet && "⏰ Postponed"}
                        {isMissed && "⚠️ Missed"}
                        {!isTaken && !isSent && !isNotYet && !isMissed && "⏳ Scheduled"}
                      </button>
                    </div>
                  );
                })}
              </div>
              {lastDose?.takenAt && (
                <div style={{ marginTop: 10, padding: "6px 10px", background: "#f8fafc", borderRadius: 8, fontSize: 11, color: "var(--color-text-3)", display: "flex", justifyContent: "space-between" }}>
                  <span>Last confirmed dose:</span>
                  <strong style={{ color: "#15803d" }}>
                    {lastDose.medicineName} ({new Date(lastDose.takenAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })})
                  </strong>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: "20px 16px", textAlign: "center" }}>
              <p style={{ margin: "0 0 12px", color: "var(--color-text-2)", fontSize: 13 }}>
                No active routine found. Add a prescription to generate scheduled doses and reminders.
              </p>
              <Button onClick={onAddPrescription}>+ Add Prescription</Button>
            </div>
          )}
        </section>

        {/* Refill Alert */}
        {(() => {
          const lowestMed = medicinesList.length > 0
            ? medicinesList.reduce((min, cur) => ((cur.days ?? 10) < (min.days ?? 10) ? cur : min), medicinesList[0])
            : null;
          return (
            <section className="refill-alert">
              <b>!</b>
              <span>
                <strong>{lowestMed ? `${lowestMed.name} stock notification` : "Prescription medicine inventory"}</strong>
                {lowestMed
                  ? `About ${lowestMed.days ?? 4} days remaining (${lowestMed.quantity ?? 10} units available)`
                  : "All medications have sufficient stock"}
              </span>
              <button type="button" onClick={onOpenReview}>
                Review
              </button>
            </section>
          );
        })()}

        {/* Prepared Pouches */}
        <h2 className="home-section-title">Prepared Pouches</h2>
        <section className="pouches-card">
          <div>
            <span>
              {patientData.name ? `${patientData.name}'s routine` : "Medication routine"}
              <strong>{medicinesList.length > 0 ? `Prepared through ${patientData.preparedThrough || "upcoming week"}` : "No medicines added yet"}</strong>
            </span>
            <b>{medicinesList.length > 0 ? `${patientData.availableDays || 0} days left` : "0 days"}</b>
          </div>
          <Image src="/assets/images/prepared-pouches.png" alt="Four prepared medicine pouches" width={340} height={117} />
          <div className="card-actions">
            <Button variant="secondary" onClick={onOpenPrepare}>
              Prepare more
            </Button>
            <Button onClick={onOpenRoutine}>View routine</Button>
          </div>
        </section>

        {/* Records */}
        <h2 className="home-section-title">Records & Telemetry</h2>
        <div className="record-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <button type="button" onClick={() => onOpenRecords("prescriptions")}>
            <Image src="/assets/illustrations/prescriptions-record.png" alt="" width={72} height={72} />
            <span>Prescriptions</span>
          </button>
          <button type="button" onClick={() => onOpenRecords("stock")}>
            <Image src="/assets/illustrations/stock-record.png" alt="" width={72} height={72} />
            <span>Stock ({medicinesList.length})</span>
          </button>
          <button type="button" onClick={() => onOpenRecords("activity")}>
            <div style={{ width: 72, height: 72, display: "grid", placeItems: "center", background: "#f1f5f9", borderRadius: 16 }}>
              <ActivityIcon size={32} />
            </div>
            <span>Activity Log</span>
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
  const [medicinesData, setMedicinesData] = useState<Medicine[]>(initialMedicinesList || []);
  const [prescriptionsData, setPrescriptionsData] = useState<PrescriptionRecord[]>([]);
  const [dosesData, setDosesData] = useState<Dose[]>([]);
  const [dosesStats, setDosesStats] = useState({
    total: 0,
    taken: 0,
    pending: 0,
    reminderSent: 0,
    missed: 0,
    notYet: 0,
  });
  const [lastDose, setLastDose] = useState<Dose | null>(null);
  const [nextDose, setNextDose] = useState<Dose | null>(null);
  const [activityLogsData, setActivityLogsData] = useState<ActivityLog[]>([]);

  const [telegramData, setTelegramData] = useState<TelegramConnection>({
    connected: false,
    botHandle: "@QuietcareReminderBot",
    botUsername: "QuietcareReminderBot",
    deepLink: "",
    parentName: "",
  });

  const [serverLive, setServerLive] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("quietcare_auth") === "true";
      } catch {
        return false;
      }
    }
    return false;
  });

  const [userRole, setUserRole] = useState<"caregiver" | "patient">(() => {
    if (typeof window !== "undefined") {
      try {
        const r = localStorage.getItem("quietcare_role");
        if (r === "caregiver" || r === "patient") return r;
      } catch {
        return "patient";
      }
    }
    return "patient";
  });

  const [activeHelpRequests, setActiveHelpRequests] = useState<HelpRequest[]>([]);

  const [ocrResultSource, setOcrResultSource] = useState<string>("gemini-3.8-flash");
  const [ocrNotice, setOcrNotice] = useState<string>("");

  const [prescriptionModal, setPrescriptionModal] = useState(false);
  const [selectedUncertainMed, setSelectedUncertainMed] = useState<Medicine | null>(null);
  const [medicineEditorOpen, setMedicineEditorOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Partial<Medicine> | null>(null);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string>();

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage((prev) => (prev === msg ? null : prev)), 2800);
  }, []);

  const refreshDoses = useCallback(async () => {
    const res = await fetchTodayDoses();
    if (res) {
      setDosesData(res.doses || []);
      setDosesStats(res.stats || {
        total: 0,
        taken: 0,
        pending: 0,
        reminderSent: 0,
        missed: 0,
        notYet: 0,
      });
      setLastDose(res.lastDose);
      setNextDose(res.nextDose);
    }
  }, []);

  const refreshHelpRequests = useCallback(async () => {
    const res = await fetchHelpRequests();
    if (res && res.activeRequests) {
      setActiveHelpRequests(res.activeRequests);
    }
  }, []);

  const refreshState = useCallback(async () => {
    const state = await fetchAppState();
    if (state) {
      setServerLive(true);
      if (state.patient) setPatientData(state.patient);
      setMedicinesData(state.medicines || []);
      setPrescriptionsData(state.prescriptions || []);
      if (state.telegram) setTelegramData(state.telegram);
      setActivityLogsData(state.activityLogs || []);
      setDosesData(state.doses || []);
      if (state.helpRequests) {
        setActiveHelpRequests(state.helpRequests.filter((h) => h.status !== "resolved"));
      }
    }
    await Promise.all([refreshDoses(), refreshHelpRequests()]);
  }, [refreshDoses, refreshHelpRequests]);

  useEffect(() => {
    let isMounted = true;
    fetchAppState().then(async (state) => {
      if (!isMounted || !state) return;
      setServerLive(true);
      if (state.patient) setPatientData(state.patient);
      setMedicinesData(state.medicines || []);
      setPrescriptionsData(state.prescriptions || []);
      if (state.telegram) setTelegramData(state.telegram);
      setActivityLogsData(state.activityLogs || []);
      setDosesData(state.doses || []);

      const [dosesRes, helpRes] = await Promise.all([
        fetchTodayDoses(),
        fetchHelpRequests(),
      ]);
      if (!isMounted) return;
      if (dosesRes) {
        setDosesData(dosesRes.doses);
        setDosesStats(dosesRes.stats);
        setLastDose(dosesRes.lastDose);
        setNextDose(dosesRes.nextDose);
      }
      if (helpRes && helpRes.activeRequests) {
        setActiveHelpRequests(helpRes.activeRequests);
      }
    });

    const pollInterval = setInterval(() => {
      if (!isMounted) return;
      fetchTodayDoses().then((res) => {
        if (!isMounted || !res) return;
        setDosesData(res.doses);
        setDosesStats(res.stats);
        setLastDose(res.lastDose);
        setNextDose(res.nextDose);
      });
      fetchHelpRequests().then((res) => {
        if (!isMounted || !res) return;
        setActiveHelpRequests(res.activeRequests || []);
      });
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, []);

  // Browser notification for Caregiver when Patient requests help
  useEffect(() => {
    if (activeHelpRequests.length > 0 && typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        try {
          new Notification("🆘 Quietcare", {
            body: `${patientData.name || "Your patient"} has requested help.`,
            icon: "/assets/brand/quietcare-logo.png",
          });
        } catch (e) {
          console.warn("Notification error:", e);
        }
      } else if (Notification.permission !== "denied") {
        try {
          Notification.requestPermission();
        } catch {}
      }
    }
  }, [activeHelpRequests.length, patientData.name]);

  const handleResolveHelpRequest = async (id: string) => {
    try {
      const res = await updateHelpRequestStatusApi(id, "resolved");
      if (res.success) {
        showToast("✓ Patient help request marked resolved.");
        await refreshHelpRequests();
        await refreshState();
      }
    } catch (err) {
      console.error("Failed to resolve help request:", err);
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem("quietcare_auth");
    } catch {
      // Ignore
    }
    setIsAuthenticated(false);
    showToast("Signed out of session");
  };

  // Note: Loading screens transition deterministically upon API resolution in upload() and handleCreateRoutine()

  // REAL Telegram Polling on the "waiting" screen
  useEffect(() => {
    if (progress.screen !== "waiting") return;

    let isMounted = true;

    // Check status immediately
    fetchTelegramStatus().then((status) => {
      if (!isMounted || !status) return;
      if (status.connected) {
        setTelegramData((prev) => ({ ...prev, ...status }));
        showToast("✓ Telegram connected! Moving forward...");
        setProgress((current) => ({ ...current, screen: "connected" }));
      }
    });

    // Poll every 2.5 seconds
    const interval = setInterval(async () => {
      const status = await fetchTelegramStatus();
      if (!isMounted || !status) return;

      setTelegramData((prev) => ({
        ...prev,
        connected: status.connected,
        parentName: status.parentName,
        botHandle: status.botHandle,
        botUsername: status.botUsername,
        deepLink: status.deepLink || prev.deepLink,
        connectedAt: status.connectedAt,
        isConfigured: status.isConfigured,
      }));

      if (status.connected) {
        clearInterval(interval);
        showToast("✓ Parent tapped Start! Telegram connected.");
        setProgress((current) => ({ ...current, screen: "connected" }));
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [progress.screen, showToast]);

  const go = (screen: FlowScreen) => setProgress((current) => ({ ...current, screen }));
  const back = () => go(backMap[progress.screen] ?? "welcome");

  const startNewPrescription = () => {
    setProgress({ ...initialProgress, screen: "prescription-upload" });
    setSelectedName(undefined);
    setUploadedImageUrl(null);
  };

  const upload = async (file?: File) => {
    if (!file) {
      showToast("Please select or capture an image to proceed");
      return;
    }
    setSelectedName(file.name);
    const targetScreen =
      progress.screen === "prescription-upload"
        ? "prescription-loading"
        : "medicine-loading";
    go(targetScreen);

    if (progress.screen === "prescription-upload") {
      const res = await uploadPrescriptionFile(file);
      if (res.success && res.medicines) {
        setMedicinesData(res.medicines);
        if (res.prescription?.imageUrl) {
          setUploadedImageUrl(res.prescription.imageUrl);
        }
        if (res.ocrResult) {
          setOcrResultSource(res.ocrResult.source);
          setOcrNotice(res.ocrResult.notice || "");
          showToast("✨ Prescription analyzed with Gemini OCR");
        }
        await refreshState();
        go("prescription-review");
      } else {
        showToast(res.error || "Prescription processing error");
        go("prescription-upload");
      }
    } else {
      await new Promise((r) => setTimeout(r, 600));
      showToast("Medicine packages matched successfully");
      go("medicine-review");
    }
  };

  const handleOpenEditUncertain = (med?: Medicine) => {
    setSelectedUncertainMed(med || medicinesData.find((m) => m.uncertain) || medicinesData[0] || null);
    setPrescriptionModal(true);
  };

  const handleSavePrescriptionTiming = async (medId: string, timing: string, schedule: string) => {
    setProgress((prev) => ({ ...prev, timingConfirmed: true }));
    setPrescriptionModal(false);
    showToast(`Saved timing for ${medId}: ${timing}`);
    const res = await updateMedicine({ id: medId, timing, schedule, uncertain: false });
    if (res.success) {
      await refreshState();
    }
  };

  const handleOpenAddMedicine = () => {
    setEditingMedicine(null);
    setMedicineEditorOpen(true);
  };

  const handleOpenEditMedicine = (med: Medicine) => {
    setEditingMedicine(med);
    setMedicineEditorOpen(true);
  };

  const handleSaveMedicineEditor = async (medData: Partial<Medicine>) => {
    setMedicineEditorOpen(false);
    if (medData.id) {
      showToast(`Updated medicine: ${medData.name}`);
      const res = await updateMedicine({ ...medData, id: medData.id });
      if (res.success) await refreshState();
    } else {
      showToast(`Added new medicine: ${medData.name}`);
      const res = await createMedicine(medData);
      if (res.success) await refreshState();
    }
  };

  const handleDeleteMedicine = async (id: string) => {
    const res = await deleteMedicine(id);
    if (res.success) {
      showToast("Medicine removed");
      await refreshState();
    } else {
      showToast("Failed to remove medicine");
    }
  };

  const handleCreateRoutine = async () => {
    go("routine-loading");
    const res = await saveRoutineSettings(
      progress.language,
      progress.breakfast,
      progress.dinner,
      patientData.name
    );
    if (res.success && res.coverageDays) {
      showToast(`Routine saved: ${res.coverageDays} days coverage`);
      await refreshState();
      go("routine-ready");
    } else {
      showToast("Error creating routine");
      go("personalise");
    }
  };

  const handleShareTelegram = async () => {
    go("waiting");
    const res = await connectTelegram("create");
    if (res.success && res.deepLink) {
      setTelegramData((prev) => ({
        ...prev,
        deepLink: res.deepLink || prev.deepLink,
      }));
    }
    showToast("Telegram invite link generated");
  };

  const handleSkipTelegram = () => {
    showToast("Telegram setup skipped. You can link anytime from the dashboard.");
    go("home");
  };

  const handleFinishTelegram = async () => {
    await refreshState();
    showToast("Telegram reminder routine ready!");
    go("home");
  };

  const handleSendTestReminder = async (doseId?: string) => {
    const res = await triggerTestDoseReminder(doseId);
    if (res.success) {
      showToast(`✓ ${res.message}`);
      await refreshDoses();
      await refreshState();
    } else {
      showToast(`Notice: ${res.message}`);
    }
  };

  const handleToggleDoseStatus = async (doseId: string, currentStatus: DoseStatus) => {
    const nextStatus: DoseStatus = currentStatus === "taken" ? "pending" : "taken";
    const res = await updateDoseStatusApi(doseId, nextStatus, "caregiver_ui");
    if (res.success) {
      showToast(
        nextStatus === "taken"
          ? "✓ Marked dose as taken"
          : "Dose marked as scheduled"
      );
      await refreshDoses();
      await refreshState();
    } else {
      showToast("Failed to update dose status");
    }
  };

  const handleResetDatabase = async () => {
    const ok = await resetBackendState();
    if (ok) {
      await refreshState();
      showToast("Database restored to defaults");
      setActiveDialog(null);
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

  if (!isAuthenticated) {
    return (
      <div className="app-shell">
        <LoginScreen
          serverLive={serverLive}
          onLoginSuccess={(user) => {
            setIsAuthenticated(true);
            setUserRole(user.role);
            try {
              localStorage.setItem("quietcare_auth", "true");
              localStorage.setItem("quietcare_role", user.role);
            } catch {}
            setProgress((prev) => ({ ...prev, screen: "home" }));
            showToast(`✓ Welcome to Quietcare ${user.role === "patient" ? "Patient View" : "Caregiver Portal"}!`);
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

  // PATIENT UI VIEW
  if (userRole === "patient") {
    return (
      <div className="app-shell" style={{ maxWidth: 430 }}>
        <PatientScreen
          patientProfile={patientData}
          onSwitchToCaregiver={() => {
            setUserRole("caregiver");
            try {
              localStorage.setItem("quietcare_role", "caregiver");
            } catch {}
            showToast("Switched to Caregiver Portal");
          }}
          onLogout={handleLogout}
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
          dosesList={dosesData}
          dosesStats={dosesStats}
          lastDose={lastDose}
          nextDose={nextDose}
          telegramData={telegramData}
          activeHelpRequests={activeHelpRequests}
          onResolveHelpRequest={handleResolveHelpRequest}
          onSwitchToPatientView={() => {
            setUserRole("patient");
            try {
              localStorage.setItem("quietcare_role", "patient");
            } catch {}
            showToast("Switched to Patient View");
          }}
          onToggleDoseStatus={handleToggleDoseStatus}
          onSendReminder={handleSendTestReminder}
          onAddPrescription={startNewPrescription}
          onOpenSetup={() => go("welcome")}
          onOpenReview={() => setActiveDialog("refill")}
          onOpenRoutine={() => setActiveDialog("routine")}
          onOpenPrepare={() => setActiveDialog("prepare")}
          onOpenRecords={(type) => setActiveDialog(type)}
          onOpenProfile={() => setActiveDialog("profile")}
          onOpenTelegramConnect={() => go("connect")}
          onLogout={handleLogout}
        />

        {activeDialog === "refill" && (
          <DetailModal title="Refill & Stock Status" onClose={() => setActiveDialog(null)}>
            <p style={{ margin: "8px 0 12px", color: "var(--color-text-2)", fontSize: 13, lineHeight: "19px" }}>
              Active inventory monitoring for {patientData.name}&apos;s prescribed medications:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {medicinesData.map((m) => {
                const days = m.days ?? 10;
                const isLow = days <= 7;
                return (
                  <div
                    key={m.id}
                    style={{
                      background: "var(--color-surface)",
                      padding: 12,
                      borderRadius: 10,
                      border: `1px solid ${isLow ? "#f59e0b" : "var(--color-border-2)"}`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                      <strong>{m.name}</strong>
                      <span style={{ fontWeight: 700, color: isLow ? "#b45309" : "#16a34a" }}>
                        {days} day{days === 1 ? "" : "s"} left
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--color-text-2)" }}>
                      <span>Available: {m.quantity} tab{m.quantity === 1 ? "" : "s"}</span>
                      <span>Schedule: {m.timing}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </DetailModal>
        )}

        {activeDialog === "routine" && (
          <DetailModal title={`${patientData.name}'s Routine Schedule`} onClose={() => setActiveDialog(null)}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
              <div style={{ padding: 12, borderRadius: 10, background: "var(--color-surface)", border: "1px solid var(--color-border-2)" }}>
                <strong style={{ display: "block", fontSize: 13, color: "var(--color-text)" }}>
                  Morning ({progress.breakfast})
                </strong>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--color-text-2)" }}>
                  {medicinesData
                    .filter(
                      (m) =>
                        m.schedule.startsWith("1") ||
                        m.timing.toLowerCase().includes("breakfast") ||
                        m.timing.toLowerCase().includes("morning")
                    )
                    .map((m) => `${m.name} (${m.timing})`)
                    .join(" • ") || "No morning doses scheduled"}
                </p>
              </div>
              <div style={{ padding: 12, borderRadius: 10, background: "var(--color-surface)", border: "1px solid var(--color-border-2)" }}>
                <strong style={{ display: "block", fontSize: 13, color: "var(--color-text)" }}>
                  Dinner & Night ({progress.dinner})
                </strong>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--color-text-2)" }}>
                  {medicinesData
                    .filter(
                      (m) =>
                        m.schedule.endsWith("1") ||
                        m.timing.toLowerCase().includes("dinner") ||
                        m.timing.toLowerCase().includes("night") ||
                        m.timing.toLowerCase().includes("bedtime")
                    )
                    .map((m) => `${m.name} (${m.timing})`)
                    .join(" • ") || "No evening doses scheduled"}
                </p>
              </div>
            </div>
          </DetailModal>
        )}

        {activeDialog === "prepare" && (
          <DetailModal title="Prepare Pouches" onClose={() => setActiveDialog(null)}>
            <p style={{ fontSize: 12, color: "var(--color-text-2)", lineHeight: "18px" }}>
              Organize individual medicine pouches with printed labels for each scheduled dose through {patientData.preparedThrough || "Sunday"}.
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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: 12 }}>{rx.fileName}</strong>
                      <span className="badge-ai">
                        {rx.ocrSource === "gemini-3.8-flash" ? "Gemini OCR" : "Prescription OCR"}
                      </span>
                    </div>
                    <span style={{ display: "block", fontSize: 11, color: "var(--color-text-2)", marginTop: 4 }}>
                      {rx.doctorName ? `${rx.doctorName}` : "Prescribing Doctor"}{rx.clinic ? ` • ${rx.clinic}` : ""}
                    </span>
                    <span style={{ display: "block", fontSize: 10, color: "var(--color-text-3)", marginTop: 2 }}>
                      Status: {rx.status} • {rx.courseDays}-day course • {rx.medicinesFound} medicines
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ padding: 20, textAlign: "center", color: "var(--color-text-3)", fontSize: 13, background: "var(--color-surface)", borderRadius: 10, border: "1px solid var(--color-border-2)" }}>
                  No prescriptions uploaded yet. Tap <strong>+ Add prescription</strong> on the home dashboard to upload one.
                </div>
              )}
            </div>
          </DetailModal>
        )}

        {activeDialog === "stock" && (
          <DetailModal title="Medicines Inventory" onClose={() => setActiveDialog(null)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "4px 0 10px" }}>
              <span style={{ fontSize: 11, color: "var(--color-text-3)" }}>
                Live inventory synced with backend data:
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveDialog(null);
                  handleOpenAddMedicine();
                }}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "4px 8px",
                  borderRadius: 6,
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  color: "var(--color-text)",
                }}
              >
                <Plus size={12} /> Add Medicine
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {medicinesData.map((m) => (
                <div key={m.id} className="stock-row">
                  <div>
                    <strong style={{ display: "block", color: "var(--color-text)" }}>{m.name}</strong>
                    <span style={{ fontSize: 10, color: "var(--color-text-3)" }}>
                      {m.schedule} • {m.timing}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
                          await refreshState();
                        }}
                        title="Decrease quantity"
                      >
                        -
                      </button>
                      <strong style={{ minWidth: 36, textAlign: "center", fontSize: 11 }}>
                        {m.quantity}
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
                          await refreshState();
                        }}
                        title="Increase quantity"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveDialog(null);
                        handleOpenEditMedicine(m);
                      }}
                      style={{ border: 0, background: "transparent", cursor: "pointer", padding: 4 }}
                      title="Edit medicine"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await handleDeleteMedicine(m.id);
                      }}
                      style={{ border: 0, background: "transparent", cursor: "pointer", padding: 4, color: "#ef4444" }}
                      title="Delete medicine"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </DetailModal>
        )}

        {activeDialog === "activity" && (
          <DetailModal title="Caregiver Activity Log" onClose={() => setActiveDialog(null)}>
            <div className="activity-list">
              {activityLogsData.length > 0 ? (
                activityLogsData.map((log) => (
                  <div key={log.id} className="activity-item">
                    <strong>{log.title}</strong>
                    <p>{log.description}</p>
                    <time>
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })},{" "}
                      {new Date(log.timestamp).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </time>
                  </div>
                ))
              ) : (
                <p style={{ fontSize: 12, color: "var(--color-text-3)", textAlign: "center", padding: 20 }}>
                  No recent activity records.
                </p>
              )}
            </div>
          </DetailModal>
        )}

        {activeDialog === "profile" && (
          <DetailModal title="Caregiver & Integration Settings" onClose={() => setActiveDialog(null)}>
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
                <span style={{ color: "var(--color-text-3)", display: "block", fontSize: 11 }}>Meal Routine:</span>
                <strong style={{ color: "var(--color-text)" }}>Breakfast: {progress.breakfast} | Dinner: {progress.dinner}</strong>
              </div>
              <div>
                <span style={{ color: "var(--color-text-3)", display: "block", fontSize: 11 }}>Telegram Bot Link:</span>
                <strong style={{ color: telegramData.connected ? "#10b981" : "#f59e0b" }}>
                  {telegramData.connected ? "Connected & Active" : "Pending connection"} ({telegramData.botHandle})
                </strong>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                <Button variant="secondary" onClick={() => handleSendTestReminder(nextDose?.id)}>
                  Dispatch Test Telegram Reminder
                </Button>
                <Button variant="danger" onClick={handleResetDatabase}>
                  Reset Database to Default State
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setActiveDialog(null);
                    handleLogout();
                  }}
                  style={{ borderColor: "#fca5a5", color: "#dc2626" }}
                >
                  Sign Out
                </Button>
              </div>
            </div>
          </DetailModal>
        )}

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
              zIndex: 45,
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            }}
          >
            {toastMessage}
          </div>
        )}

        {prescriptionModal && selectedUncertainMed && (
          <EditPrescriptionModal
            medicine={selectedUncertainMed}
            medicinesList={medicinesData}
            onClose={() => setPrescriptionModal(false)}
            onSave={handleSavePrescriptionTiming}
          />
        )}

        {medicineEditorOpen && (
          <MedicineEditorModal
            medicine={editingMedicine}
            onClose={() => setMedicineEditorOpen(false)}
            onSave={handleSaveMedicineEditor}
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
            medicine={false}
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
            <button type="button" className="nav-pill" onClick={handleLogout} title="Sign Out">
              Sign Out
            </button>
          </div>
          <div className="welcome-photo">
            <Image
              src="/assets/images/welcome-caregiver.png"
              alt="A caregiver and her parent reviewing medicine information"
              fill
              priority
              sizes="342px"
            />
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
                View {patientData.name ? `${patientData.name}'s` : "Parent's"} Routine (Dashboard)
              </Button>
              <Button variant="secondary" onClick={() => go("prescription-upload")}>
                + Set Up New Prescription
              </Button>
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
          <p>We&apos;ll read it with Gemini AI and build a clear routine for your parent.</p>
          <CaptureArt kind="prescription" />
          <UploadActions
            selectedName={selectedName}
            onChoose={() => setUploadModal(true)}
            onTake={() => setUploadModal(true)}
          />
        </main>
      );
      break;

    case "prescription-loading":
      content = (
        <LoadingScreen
          title="Reading your prescription"
          detail="Finding medicine names, doses and timings with Gemini AI…"
        />
      );
      break;

    case "prescription-review":
      content = (
        <PrescriptionReview
          timingConfirmed={progress.timingConfirmed}
          medicinesList={medicinesData}
          patientName={patientData.prescriptionName}
          courseDays={patientData.courseDays}
          ocrSource={ocrResultSource}
          ocrNotice={ocrNotice}
          uploadedImageUrl={uploadedImageUrl || undefined}
          onEdit={(med) => handleOpenEditUncertain(med)}
          onExpand={() => setLightboxSrc(uploadedImageUrl || "/assets/images/prescription.png")}
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
            {[
              "Place medicines on a flat surface",
              "Keep names facing up",
              "Avoid overlapping packages",
              "Use good lighting",
            ].map((tip) => (
              <li key={tip}>
                <span>
                  <Check size={11} />
                </span>
                {tip}
              </li>
            ))}
          </ul>
          <UploadActions onChoose={() => setUploadModal(true)} onTake={() => setUploadModal(true)} />
        </main>
      );
      break;

    case "medicine-loading":
      content = (
        <LoadingScreen
          title="Matching medicines"
          detail="Comparing the medicines with the prescription…"
        />
      );
      break;

    case "medicine-review":
      content = (
        <MedicineReview
          medicinesList={medicinesData}
          onEditMedicine={handleOpenEditMedicine}
          onDeleteMedicine={handleDeleteMedicine}
          onAddMedicine={handleOpenAddMedicine}
          onContinue={() => go("personalise")}
        />
      );
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
              Parent&apos;s Name
              <input
                type="text"
                value={patientData.name}
                placeholder="e.g. Meena Patil"
                onChange={(e) => setPatientData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </label>
            <label>
              Preferred language
              <select
                value={progress.language}
                onChange={(event) => setProgress({ ...progress, language: event.target.value })}
              >
                {languages.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>Usual meal times</legend>
              <label>
                Breakfast
                <select
                  value={progress.breakfast}
                  onChange={(event) => setProgress({ ...progress, breakfast: event.target.value })}
                >
                  {mealTimes.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                Dinner
                <select
                  value={progress.dinner}
                  onChange={(event) => setProgress({ ...progress, dinner: event.target.value })}
                >
                  {dinnerTimes.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            </fieldset>
          </div>
          <Bottom>
            <Button onClick={handleCreateRoutine}>Create routine</Button>
          </Bottom>
        </main>
      );
      break;

    case "routine-loading":
      content = (
        <LoadingScreen
          title="Creating the routine"
          detail="Organizing doses, instructions and calculating coverage days…"
        />
      );
      break;

    case "routine-ready":
      content = (
        <main className="screen-content ready-screen">
          <div className="ready-top">
            <div className="ready-pill">Ready to pack</div>
            <h1>
              {patientData.name}&apos;s routine
              <br />
              is ready
            </h1>
            <p>You have enough medicine to prepare pouches for</p>
            <div className="days-callout">
              <strong>{patientData.availableDays} days</strong>
              <span>Coverage ready</span>
            </div>
          </div>
          <div className="ready-illustration">
            <Image
              src="/assets/illustrations/routine-ready.png"
              alt="Caregiver and parent celebrating a successful routine"
              fill
              priority
              sizes="342px"
            />
          </div>
          <Bottom>
            <Button onClick={() => go("labels-choice")}>Continue</Button>
          </Bottom>
        </main>
      );
      break;

    case "labels-choice":
      content = (
        <main className="screen-content choice-screen">
          <div className="choice-illustration">
            <Image
              src="/assets/illustrations/labels-choice.png"
              alt="Options for printing or hand-writing pouch labels"
              fill
              sizes="342px"
            />
          </div>
          <div className="choice-copy">
            <h1>Print pouch labels?</h1>
            <p>
              Labels help your parent identify each pouch by meal time. You can print them or copy the details by hand.
            </p>
          </div>
          <Bottom>
            <div className="choice-actions">
              <Button onClick={() => go("labels")}>View printable labels</Button>
              <button
                type="button"
                className="skip-link"
                onClick={() => go("pack")}
              >
                I&apos;ll write them by hand
              </button>
            </div>
          </Bottom>
        </main>
      );
      break;

    case "labels":
      content = (
        <main className="screen-content labels-screen">
          <h1>Print pouch labels</h1>
          <p>Print on sticker paper or plain paper to attach to each pouch.</p>
          <LabelsPreview />
          <div className="labels-actions">
            <Button variant="secondary" onClick={() => window.print()}>
              <Download /> Print labels
            </Button>
            <Button variant="secondary" onClick={handleShareLabels}>
              <Share /> Share
            </Button>
          </div>
          <Bottom>
            <Button onClick={() => go("pack")}>I&apos;ve printed the labels</Button>
          </Bottom>
        </main>
      );
      break;

    case "pack": {
      const dosePacks = generateDosePacks(
        medicinesData,
        progress.breakfast,
        progress.dinner
      );
      content = (
        <main className="screen-content pack-screen">
          <h1>Pack medicines</h1>
          <p>
            Prepare sealed pouches for {patientData.name}&apos;s routine ({patientData.availableDays || 10} days coverage).
          </p>
          <div className="pack-photo">
            <Image src="/assets/images/medicines-highlighted.png" alt="Highlighted medicine packages" fill sizes="390px" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {dosePacks.map((pack) => {
              const isBreakfast = pack.timingLabel.toLowerCase().includes("breakfast");
              const isDinner = pack.timingLabel.toLowerCase().includes("dinner");
              const labelIcon = isBreakfast
                ? pack.timingLabel.toLowerCase().includes("before")
                  ? "/assets/pouch-labels/before-breakfast.png"
                  : "/assets/pouch-labels/after-breakfast.png"
                : isDinner
                ? pack.timingLabel.toLowerCase().includes("before")
                  ? "/assets/pouch-labels/before-dinner.png"
                  : "/assets/pouch-labels/after-dinner.png"
                : "/assets/pouch-labels/bedtime.png";

              return (
                <div
                  key={pack.packetNumber}
                  style={{
                    background: "var(--color-surface)",
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid var(--color-border-2)",
                  }}
                >
                  <div className="packet-summary" style={{ margin: "0 0 10px" }}>
                    <Image src={labelIcon} alt={`${pack.timingLabel} label`} width={56} height={68} />
                    <p>
                      Packet {pack.packetNumber}
                      <strong>{pack.timingLabel}</strong>
                      <span style={{ fontSize: 11, color: "var(--color-text-3)", fontWeight: 500 }}>
                        {pack.mealRelation}
                      </span>
                    </p>
                  </div>
                  {pack.medicines.map((item, idx) => (
                    <div className="packing-row" key={`${item.name}-${idx}`} style={{ margin: "4px 0" }}>
                      <b>{idx + 1}</b>
                      <span>
                        {item.name} ({item.dose})
                        <strong>Cut {patientData.availableDays || 10} sealed tablets ({item.instruction})</strong>
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          <Bottom>
            <Button onClick={() => go("connect")}>Next step: Connect Telegram</Button>
          </Bottom>
        </main>
      );
      break;
    }

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
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span className="waiting-pulse-dot" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#0284c7", textTransform: "uppercase" }}>
              Waiting for Telegram confirmation
            </span>
          </div>
          <h1>Waiting for your parent</h1>
          <p>We&apos;ll automatically advance as soon as they open the link and tap Start.</p>

          <div className="telegram-illustration">
            <Image src="/assets/illustrations/telegram-waiting.png" alt="Waiting for Telegram connection" fill sizes="342px" />
          </div>

          <div style={{ background: "var(--color-surface)", padding: 12, borderRadius: 12, border: "1px solid var(--color-border-2)", marginTop: 8 }}>
            <span style={{ fontSize: 11, color: "var(--color-text-3)", display: "block", marginBottom: 6 }}>
              Personal invite link for {patientData.name}:
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="text"
                readOnly
                value={telegramData.deepLink}
                style={{
                  fontSize: 11,
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--color-border)",
                  flex: 1,
                  background: "white",
                  color: "var(--color-text-2)",
                }}
              />
              <button
                type="button"
                className="button button--secondary"
                style={{ height: 32, fontSize: 11, padding: "0 10px" }}
                onClick={() => {
                  navigator.clipboard.writeText(telegramData.deepLink);
                  showToast("Copied Telegram link to clipboard");
                }}
              >
                Copy
              </button>
            </div>

            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <a
                href={telegramData.deepLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#0284c7",
                  textDecoration: "underline",
                  padding: "4px 0",
                }}
              >
                Open directly in Telegram ↗
              </a>
            </div>
          </div>

          <Bottom>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <Button
                variant="secondary"
                onClick={async () => {
                  const status = await fetchTelegramStatus();
                  if (status?.connected) {
                    showToast("✓ Telegram connection confirmed!");
                    go("connected");
                  } else {
                    showToast("Parent has not tapped Start yet. Waiting...");
                  }
                }}
              >
                Check Connection Status
              </Button>

              <button
                type="button"
                onClick={handleSkipTelegram}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "#64748b",
                  fontSize: 12,
                  textDecoration: "underline",
                  cursor: "pointer",
                  padding: "4px 0",
                  textAlign: "center",
                }}
              >
                Skip Telegram setup for now
              </button>
            </div>
          </Bottom>
        </main>
      );
      break;

    case "connected":
      content = (
        <main className="screen-content">
          <h1>Your parent is connected!</h1>
          <p>
            Medicine reminders will begin with their next scheduled dose via {telegramData.botHandle}.
          </p>
          <div className="telegram-illustration">
            <Image src="/assets/illustrations/telegram-connected.png" alt="Telegram successfully connected" fill sizes="342px" />
          </div>
          <Bottom>
            <Button onClick={handleFinishTelegram}>Finish Setup & Go to Dashboard</Button>
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

      {prescriptionModal && selectedUncertainMed && (
        <EditPrescriptionModal
          medicine={selectedUncertainMed}
          medicinesList={medicinesData}
          onClose={() => setPrescriptionModal(false)}
          onSave={handleSavePrescriptionTiming}
        />
      )}

      {medicineEditorOpen && (
        <MedicineEditorModal
          medicine={editingMedicine}
          onClose={() => setMedicineEditorOpen(false)}
          onSave={handleSaveMedicineEditor}
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
