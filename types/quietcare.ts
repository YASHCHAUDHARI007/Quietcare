export type FlowScreen =
  | "welcome"
  | "prescription-upload"
  | "prescription-loading"
  | "prescription-review"
  | "medicine-upload"
  | "medicine-loading"
  | "medicine-review"
  | "personalise"
  | "routine-loading"
  | "routine-ready"
  | "labels-choice"
  | "labels"
  | "pack"
  | "connect"
  | "waiting"
  | "connected"
  | "home";

export type Medicine = {
  id: string;
  name: string;
  strength?: string;
  schedule: string;
  timing: string;
  days: number;
  quantity: number;
  instructions?: string;
  uncertain?: boolean;
};

export type PatientProfile = {
  id: string;
  name: string;
  prescriptionName: string;
  courseDays: number;
  availableDays: number;
  preparedThrough: string;
  daysLeft: number;
};

export type Caregiver = {
  id: string;
  name: string;
  email?: string;
  role: string;
};

export type PrescriptionRecord = {
  id: string;
  fileName: string;
  doctorName?: string;
  clinic?: string;
  uploadedAt: string;
  courseDays: number;
  medicinesFound: number;
  status: "verified" | "review-needed" | "pending";
  imageUrl?: string;
  ocrConfidence?: number;
  ocrSource?: "gemini-3.8-flash" | "demo_fallback";
  uncertainNotice?: string;
};

export type RoutineSchedule = {
  id?: string;
  language: string;
  breakfastTime: string;
  dinnerTime: string;
  coverageDays: number;
  preparedThrough: string;
  dosePacks: Array<{
    packetNumber: number;
    timingLabel: string;
    mealRelation: string;
    medicines: Array<{ name: string; dose: string; instruction: string }>;
  }>;
};

export type DoseStatus =
  | "pending"
  | "reminder_sent"
  | "taken"
  | "not_yet"
  | "missed";

export type Dose = {
  id: string;
  medicineId: string;
  medicineName: string;
  doseAmount: string;
  patientId: string;
  scheduledAt: string; // ISO timestamp
  scheduledTimeLabel: string; // e.g. "8:00 AM", "2:30 PM", "7:30 PM", "9:00 PM"
  timing: string; // "Before Breakfast", "After Breakfast", "Before Dinner", "After Dinner"
  status: DoseStatus;
  takenAt?: string;
  reminderSentAt?: string;
  followUpSentAt?: string;
  telegramMessageId?: number;
  notes?: string;
};

export type DoseLog = {
  id: string;
  doseId: string;
  status: DoseStatus;
  timestamp: string;
  source: "telegram" | "caregiver_ui" | "system";
  telegramChatId?: number | string;
};

export type TelegramConnection = {
  connected: boolean;
  botHandle: string;
  botUsername?: string;
  deepLink: string;
  parentTelegramId?: string;
  parentChatId?: number | string;
  parentName?: string;
  connectedAt?: string;
  lastReminderSent?: string;
  isConfigured?: boolean;
};

export type ConnectionToken = {
  token: string;
  patientId: string;
  createdAt: string;
  expiry: string;
  used: boolean;
};

export type ActivityLog = {
  id: string;
  timestamp: string;
  type:
    | "dose_taken"
    | "dose_not_yet"
    | "dose_missed"
    | "reminder_sent"
    | "prescription_added"
    | "prescription_uploaded"
    | "prescription_analyzed"
    | "stock_alert"
    | "routine_created"
    | "medicine_edited"
    | "telegram_connected";
  title: string;
  description: string;
};

export type QuietcareAppState = {
  patient: PatientProfile;
  caregiver?: Caregiver;
  medicines: Medicine[];
  prescriptions: PrescriptionRecord[];
  routine: RoutineSchedule;
  doses: Dose[];
  doseLogs: DoseLog[];
  telegram: TelegramConnection;
  activityLogs: ActivityLog[];
  pendingTokens: ConnectionToken[];
};

export type QuietcareProgress = {
  screen: FlowScreen;
  timingConfirmed: boolean;
  language: string;
  breakfast: string;
  dinner: string;
};
