import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { createISTIsoString, getISTDateParts, getISTNowIso } from "@/lib/timezone";
import type {
  ActivityLog,
  ConnectionToken,
  Dose,
  DoseLog,
  DoseStatus,
  Medicine,
  PatientProfile,
  PrescriptionRecord,
  QuietcareAppState,
  RoutineSchedule,
  TelegramConnection,
} from "@/types/quietcare";

const DATA_FILE_PATH = path.join(process.cwd(), "data", "quietcare-store.json");

const defaultPatient: PatientProfile = {
  id: "patient_meena",
  name: "Meena",
  prescriptionName: "Shobha Patil",
  courseDays: 10,
  availableDays: 7,
  preparedThrough: "10 sep",
  daysLeft: 5,
};

const defaultMedicines: Medicine[] = [
  {
    id: "vertin",
    name: "Vertin 2mg",
    strength: "2mg",
    schedule: "1-0-1",
    timing: "After food",
    days: 3,
    quantity: 20,
    instructions: "Do not crush",
    uncertain: true,
  },
  {
    id: "metformin",
    name: "Metformin 500mg",
    strength: "500mg",
    schedule: "1-0-1",
    timing: "After food",
    days: 10,
    quantity: 20,
    instructions: "Take after meal",
  },
  {
    id: "telma",
    name: "Telma 40mg",
    strength: "40mg",
    schedule: "1-0-1",
    timing: "Before Dinner",
    days: 10,
    quantity: 20,
    instructions: "Blood pressure support",
  },
  {
    id: "pantop",
    name: "Pantop 40mg",
    strength: "40mg",
    schedule: "1-0-0",
    timing: "Before breakfast",
    days: 10,
    quantity: 20,
    instructions: "Take with water 30 mins before breakfast",
  },
];

const defaultPrescriptions: PrescriptionRecord[] = [
  {
    id: "rx_demo_01",
    fileName: "Dr_Kulkarni_Cardio_Prescription.png",
    doctorName: "Dr. S. Kulkarni",
    clinic: "Cardiology & Geriatric Care Clinic",
    uploadedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    courseDays: 10,
    medicinesFound: 4,
    status: "review-needed",
    imageUrl: "/assets/images/prescription.png",
    ocrConfidence: 0.94,
    ocrSource: "demo_fallback",
    uncertainNotice: "Vertin 2mg timing requires caregiver confirmation",
  },
];

const defaultRoutine: RoutineSchedule = {
  language: "Marathi",
  breakfastTime: "8:00 am",
  dinnerTime: "7:30 pm",
  coverageDays: 7,
  preparedThrough: "10 sep",
  dosePacks: [
    {
      packetNumber: 1,
      timingLabel: "Before Breakfast",
      mealRelation: "30 mins before food",
      medicines: [
        { name: "Pantop 40mg", dose: "1 tablet", instruction: "Take with water" },
      ],
    },
    {
      packetNumber: 2,
      timingLabel: "After Breakfast",
      mealRelation: "Within 15 mins after breakfast",
      medicines: [
        { name: "Vertin 2mg", dose: "1 tablet", instruction: "Do not crush" },
        { name: "Metformin 500mg", dose: "1 tablet", instruction: "Take after meal" },
      ],
    },
    {
      packetNumber: 3,
      timingLabel: "Before Dinner",
      mealRelation: "15 mins before dinner",
      medicines: [
        { name: "Telma 40mg", dose: "1 tablet", instruction: "Blood pressure support" },
      ],
    },
    {
      packetNumber: 4,
      timingLabel: "After Dinner",
      mealRelation: "After dinner before bed",
      medicines: [
        { name: "Vertin 2mg", dose: "1 tablet", instruction: "Night dose" },
      ],
    },
  ],
};

function generateInitialTodayDoses(): Dose[] {
  const { datePrefix } = getISTDateParts();

  return [
    {
      id: "dose_1_bb",
      medicineId: "pantop",
      medicineName: "Pantop 40mg",
      doseAmount: "1 tablet",
      patientId: "patient_meena",
      scheduledAt: createISTIsoString(datePrefix, 8, 0),
      scheduledTimeLabel: "8:00 AM",
      timing: "Before Breakfast",
      status: "taken",
      takenAt: createISTIsoString(datePrefix, 8, 5),
      notes: "Taken 30 mins before meal",
    },
    {
      id: "dose_2_ab",
      medicineId: "metformin",
      medicineName: "Metformin 500mg",
      doseAmount: "1 tablet",
      patientId: "patient_meena",
      scheduledAt: createISTIsoString(datePrefix, 8, 30),
      scheduledTimeLabel: "8:30 AM",
      timing: "After Breakfast",
      status: "taken",
      takenAt: createISTIsoString(datePrefix, 8, 35),
      notes: "Taken with breakfast",
    },
    {
      id: "dose_3_bd",
      medicineId: "telma",
      medicineName: "Telma 40mg",
      doseAmount: "1 tablet",
      patientId: "patient_meena",
      scheduledAt: createISTIsoString(datePrefix, 19, 30),
      scheduledTimeLabel: "7:30 PM",
      timing: "Before Dinner",
      status: "pending",
      notes: "Blood pressure support dose",
    },
    {
      id: "dose_4_ad",
      medicineId: "vertin",
      medicineName: "Vertin 2mg",
      doseAmount: "1 tablet",
      patientId: "patient_meena",
      scheduledAt: createISTIsoString(datePrefix, 21, 0),
      scheduledTimeLabel: "9:00 PM",
      timing: "After Dinner",
      status: "pending",
      notes: "Night dose before sleep",
    },
  ];
}

const defaultTelegram: TelegramConnection = {
  connected: false,
  botHandle: "@QuietcareReminderBot",
  botUsername: "QuietcareReminderBot",
  deepLink: "https://t.me/QuietcareReminderBot?start=qc_meena_demo",
  parentName: "Meena",
  isConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
};

const defaultLogs: ActivityLog[] = [
  {
    id: "log_init_1",
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    type: "dose_taken",
    title: "Morning dose confirmed",
    description: "Pantop 40mg & Metformin 500mg marked taken for Meena",
  },
  {
    id: "log_init_2",
    timestamp: new Date(Date.now() - 3600000 * 8).toISOString(),
    type: "stock_alert",
    title: "Medicine stock initialized",
    description: "4 medicines in routine with 7 days coverage prepared",
  },
  {
    id: "log_init_3",
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
    type: "prescription_uploaded",
    title: "Prescription analyzed",
    description: "Found 4 medicines from Dr. S. Kulkarni prescription slip",
  },
];

let memoryStore: QuietcareAppState | null = null;

async function loadFromDisk(): Promise<QuietcareAppState> {
  try {
    const raw = await fs.readFile(DATA_FILE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<QuietcareAppState>;

    return {
      patient: parsed.patient || defaultPatient,
      medicines: parsed.medicines && parsed.medicines.length > 0 ? parsed.medicines : defaultMedicines,
      prescriptions: parsed.prescriptions || defaultPrescriptions,
      routine: parsed.routine || defaultRoutine,
      doses: parsed.doses && parsed.doses.length > 0 ? parsed.doses : generateInitialTodayDoses(),
      doseLogs: parsed.doseLogs || [],
      telegram: {
        ...defaultTelegram,
        ...(parsed.telegram || {}),
        isConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      },
      activityLogs: parsed.activityLogs || defaultLogs,
      pendingTokens: parsed.pendingTokens || [],
    };
  } catch {
    const fresh: QuietcareAppState = {
      patient: defaultPatient,
      medicines: defaultMedicines,
      prescriptions: defaultPrescriptions,
      routine: defaultRoutine,
      doses: generateInitialTodayDoses(),
      doseLogs: [],
      telegram: defaultTelegram,
      activityLogs: defaultLogs,
      pendingTokens: [],
    };
    await saveToDisk(fresh);
    return fresh;
  }
}

async function saveToDisk(state: QuietcareAppState): Promise<void> {
  try {
    await fs.mkdir(path.dirname(DATA_FILE_PATH), { recursive: true });
    await fs.writeFile(DATA_FILE_PATH, JSON.stringify(state, null, 2), "utf-8");
  } catch (error) {
    console.error("[Quietcare Repository] Failed to write state to disk:", error);
  }
}

export class QuietcareRepository {
  static async getState(): Promise<QuietcareAppState> {
    if (!memoryStore) {
      memoryStore = await loadFromDisk();
    }
    // Update config flag dynamically
    memoryStore.telegram.isConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN);
    return memoryStore;
  }

  static async updateState(
    updater: (prev: QuietcareAppState) => QuietcareAppState
  ): Promise<QuietcareAppState> {
    const current = await this.getState();
    const updated = updater(current);
    memoryStore = updated;
    await saveToDisk(updated);
    return updated;
  }

  static async resetState(): Promise<QuietcareAppState> {
    const reset: QuietcareAppState = {
      patient: defaultPatient,
      medicines: defaultMedicines,
      prescriptions: defaultPrescriptions,
      routine: defaultRoutine,
      doses: generateInitialTodayDoses(),
      doseLogs: [],
      telegram: {
        ...defaultTelegram,
        isConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      },
      activityLogs: defaultLogs,
      pendingTokens: [],
    };
    memoryStore = reset;
    await saveToDisk(reset);
    return reset;
  }

  // Dose Operations
  static async getTodayDoses(): Promise<Dose[]> {
    const state = await this.getState();
    return state.doses || [];
  }

  static async getDoseById(doseId: string): Promise<Dose | null> {
    const state = await this.getState();
    return state.doses.find((d) => d.id === doseId) || null;
  }

  static async updateDoseStatus(
    doseId: string,
    status: DoseStatus,
    source: "telegram" | "caregiver_ui" | "system",
    telegramChatId?: number | string
  ): Promise<{ success: boolean; dose?: Dose }> {
    let updatedDose: Dose | undefined;

    await this.updateState((prev) => {
      const nowIso = new Date().toISOString();
      const updatedDoses = prev.doses.map((d) => {
        if (d.id === doseId) {
          updatedDose = {
            ...d,
            status,
            takenAt: status === "taken" ? nowIso : status === "pending" ? undefined : d.takenAt,
            reminderSentAt: status === "reminder_sent" ? nowIso : d.reminderSentAt,
          };
          return updatedDose;
        }
        return d;
      });

      const newDoseLog: DoseLog = {
        id: `doselog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        doseId,
        status,
        timestamp: nowIso,
        source,
        telegramChatId,
      };

      const activityType =
        status === "taken"
          ? "dose_taken"
          : status === "not_yet"
          ? "dose_not_yet"
          : status === "missed"
          ? "dose_missed"
          : "reminder_sent";

      const doseName = updatedDose?.medicineName || "Dose";
      const timingLabel = updatedDose?.timing || "Scheduled dose";

      const sourceLabel =
        source === "telegram"
          ? "via Parent's Telegram"
          : source === "caregiver_ui"
          ? "via Caregiver Dashboard"
          : "via System Scheduler";

      const newActivity: ActivityLog = {
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: nowIso,
        type: activityType,
        title:
          status === "taken"
            ? `${doseName} marked as Taken`
            : status === "not_yet"
            ? `${doseName} marked Not Yet`
            : status === "missed"
            ? `${doseName} marked as Missed`
            : `Reminder dispatched for ${doseName}`,
        description: `${timingLabel} (${updatedDose?.scheduledTimeLabel || ""}) ${sourceLabel}`,
      };

      return {
        ...prev,
        doses: updatedDoses,
        doseLogs: [newDoseLog, ...prev.doseLogs],
        activityLogs: [newActivity, ...prev.activityLogs],
      };
    });

    return { success: Boolean(updatedDose), dose: updatedDose };
  }

  // Telegram Connection Token Management
  static async createPendingToken(patientId: string = "patient_meena"): Promise<ConnectionToken> {
    const rawToken = crypto.randomBytes(12).toString("hex");
    const token = `qc_${rawToken}`;
    const now = new Date();
    const expiry = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // 24 hour expiry

    const newToken: ConnectionToken = {
      token,
      patientId,
      createdAt: now.toISOString(),
      expiry,
      used: false,
    };

    await this.updateState((prev) => ({
      ...prev,
      pendingTokens: [newToken, ...prev.pendingTokens.filter((t) => !t.used && new Date(t.expiry) > now)],
    }));

    return newToken;
  }

  static async validateAndUsePendingToken(token: string): Promise<ConnectionToken | null> {
    const state = await this.getState();
    const now = new Date();

    const target = state.pendingTokens.find(
      (t) => t.token === token && !t.used && new Date(t.expiry) > now
    );

    if (!target) {
      // Also allow default demo token if in development
      if (token === "qc_meena_demo" || token === "qc_meena_7829") {
        return {
          token,
          patientId: state.patient.id,
          createdAt: new Date().toISOString(),
          expiry: new Date(Date.now() + 86400000).toISOString(),
          used: false,
        };
      }
      return null;
    }

    // Mark as used
    await this.updateState((prev) => ({
      ...prev,
      pendingTokens: prev.pendingTokens.map((t) =>
        t.token === token ? { ...t, used: true } : t
      ),
    }));

    return target;
  }

  static async connectTelegram(
    patientId: string,
    chatId: number | string,
    parentTelegramId?: string
  ): Promise<TelegramConnection> {
    let updatedConnection: TelegramConnection = defaultTelegram;

    await this.updateState((prev) => {
      const nowIso = new Date().toISOString();
      updatedConnection = {
        ...prev.telegram,
        connected: true,
        parentChatId: chatId,
        parentTelegramId: parentTelegramId || String(chatId),
        connectedAt: nowIso,
        parentName: prev.patient.name,
      };

      const newLog: ActivityLog = {
        id: `act_${Date.now()}`,
        timestamp: nowIso,
        type: "telegram_connected",
        title: `Telegram Connected for ${prev.patient.name}`,
        description: `Verified connection established with Chat ID: ${chatId}`,
      };

      return {
        ...prev,
        telegram: updatedConnection,
        activityLogs: [newLog, ...prev.activityLogs],
      };
    });

    return updatedConnection;
  }

  static async disconnectTelegram(): Promise<TelegramConnection> {
    let updatedConnection: TelegramConnection = defaultTelegram;

    await this.updateState((prev) => {
      updatedConnection = {
        ...prev.telegram,
        connected: false,
        parentChatId: undefined,
        parentTelegramId: undefined,
      };

      const newLog: ActivityLog = {
        id: `act_${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "telegram_connected",
        title: `Telegram Disconnected`,
        description: `Alert connection unlinked by caregiver`,
      };

      return {
        ...prev,
        telegram: updatedConnection,
        activityLogs: [newLog, ...prev.activityLogs],
      };
    });

    return updatedConnection;
  }

  static async addActivityLog(
    log: Omit<ActivityLog, "id" | "timestamp">
  ): Promise<ActivityLog> {
    const newLog: ActivityLog = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...log,
    };

    await this.updateState((prev) => ({
      ...prev,
      activityLogs: [newLog, ...prev.activityLogs],
    }));

    return newLog;
  }
}
