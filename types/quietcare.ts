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
  schedule: string;
  timing: string;
  days: number;
  quantity: number;
  uncertain?: boolean;
};

export type PatientProfile = {
  name: string;
  prescriptionName: string;
  courseDays: number;
  availableDays: number;
  preparedThrough: string;
  daysLeft: number;
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
};

export type RoutineSchedule = {
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

export type TelegramConnection = {
  connected: boolean;
  botHandle: string;
  deepLink: string;
  parentTelegramId?: string;
  parentName?: string;
  lastReminderSent?: string;
};

export type ActivityLog = {
  id: string;
  timestamp: string;
  type: "dose_taken" | "prescription_added" | "stock_alert" | "routine_created" | "telegram_connected";
  title: string;
  description: string;
};

export type QuietcareAppState = {
  patient: PatientProfile;
  medicines: Medicine[];
  prescriptions: PrescriptionRecord[];
  routine: RoutineSchedule;
  telegram: TelegramConnection;
  activityLogs: ActivityLog[];
};

export type QuietcareProgress = {
  screen: FlowScreen;
  timingConfirmed: boolean;
  language: string;
  breakfast: string;
  dinner: string;
};
