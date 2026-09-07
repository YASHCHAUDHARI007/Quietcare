import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { getISTNowIso } from "@/lib/timezone";
import type {
  ActivityLog,
  ConnectionToken,
  Dose,
  DoseLog,
  DoseStatus,
  HelpRequest,
  HelpRequestStatus,
  PatientProfile,
  QuietcareAppState,
  RoutineSchedule,
  TelegramConnection,
} from "@/types/quietcare";

const DATA_FILE_PATH = path.join(process.cwd(), "data", "quietcare-store.json");

const defaultPatient: PatientProfile = {
  id: "patient_primary",
  name: "",
  prescriptionName: "",
  courseDays: 0,
  availableDays: 0,
  preparedThrough: "",
  daysLeft: 0,
};

const defaultRoutine: RoutineSchedule = {
  language: "Marathi",
  breakfastTime: "8:00 am",
  dinnerTime: "7:30 pm",
  coverageDays: 0,
  preparedThrough: "",
  dosePacks: [],
};

const defaultTelegram: TelegramConnection = {
  connected: false,
  botHandle: "@QuietcareReminderBot",
  botUsername: "QuietcareReminderBot",
  deepLink: "",
  parentName: "",
  isConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
};

let memoryStore: QuietcareAppState | null = null;

async function loadFromDisk(): Promise<QuietcareAppState> {
  try {
    const raw = await fs.readFile(DATA_FILE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<QuietcareAppState>;

    return {
      patient: parsed.patient || defaultPatient,
      medicines: parsed.medicines || [],
      prescriptions: parsed.prescriptions || [],
      routine: parsed.routine || defaultRoutine,
      doses: parsed.doses || [],
      doseLogs: parsed.doseLogs || [],
      telegram: {
        ...defaultTelegram,
        ...(parsed.telegram || {}),
        isConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      },
      activityLogs: parsed.activityLogs || [],
      pendingTokens: parsed.pendingTokens || [],
      helpRequests: parsed.helpRequests || [],
    };
  } catch {
    const fresh: QuietcareAppState = {
      patient: defaultPatient,
      medicines: [],
      prescriptions: [],
      routine: defaultRoutine,
      doses: [],
      doseLogs: [],
      telegram: defaultTelegram,
      activityLogs: [],
      pendingTokens: [],
      helpRequests: [],
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
      medicines: [],
      prescriptions: [],
      routine: defaultRoutine,
      doses: [],
      doseLogs: [],
      telegram: {
        ...defaultTelegram,
        isConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      },
      activityLogs: [],
      pendingTokens: [],
      helpRequests: [],
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
    source: "telegram" | "caregiver_ui" | "patient_ui" | "system",
    telegramChatId?: number | string
  ): Promise<{ success: boolean; dose?: Dose }> {
    let updatedDose: Dose | undefined;

    await this.updateState((prev) => {
      const nowIso = getISTNowIso();
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
          : source === "patient_ui"
          ? "via Patient View"
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
  static async createPendingToken(patientId: string = "patient_primary"): Promise<ConnectionToken> {
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
      const nowIso = getISTNowIso();
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
      const nowIso = getISTNowIso();
      updatedConnection = {
        ...prev.telegram,
        connected: false,
        parentChatId: undefined,
        parentTelegramId: undefined,
      };

      const newLog: ActivityLog = {
        id: `act_${Date.now()}`,
        timestamp: nowIso,
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
      timestamp: getISTNowIso(),
      ...log,
    };

    await this.updateState((prev) => ({
      ...prev,
      activityLogs: [newLog, ...prev.activityLogs],
    }));

    return newLog;
  }

  // Help Request Operations
  static async getHelpRequests(): Promise<HelpRequest[]> {
    const state = await this.getState();
    return state.helpRequests || [];
  }

  static async createHelpRequest(
    patientId: string = "patient_primary",
    message?: string
  ): Promise<HelpRequest> {
    const nowIso = getISTNowIso();
    let newRequest: HelpRequest | undefined;

    await this.updateState((prev) => {
      newRequest = {
        id: `help_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        patientId,
        patientName: prev.patient?.name || "Patient",
        createdAt: nowIso,
        status: "active",
        message: message || "Patient requested assistance via Patient View",
      };

      const newActivity: ActivityLog = {
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: nowIso,
        type: "help_requested",
        title: `🆘 Help Requested by ${prev.patient?.name || "Patient"}`,
        description: message || "Immediate assistance requested via Patient View",
      };

      return {
        ...prev,
        helpRequests: [newRequest!, ...(prev.helpRequests || [])],
        activityLogs: [newActivity, ...prev.activityLogs],
      };
    });

    return newRequest!;
  }

  static async updateHelpRequestStatus(
    requestId: string,
    status: HelpRequestStatus
  ): Promise<HelpRequest | null> {
    let updated: HelpRequest | null = null;
    const nowIso = getISTNowIso();

    await this.updateState((prev) => {
      const requests = (prev.helpRequests || []).map((req) => {
        if (req.id === requestId) {
          updated = {
            ...req,
            status,
            resolvedAt: status === "resolved" ? nowIso : req.resolvedAt,
          };
          return updated;
        }
        return req;
      });

      const activities = [...prev.activityLogs];
      if (status === "resolved") {
        activities.unshift({
          id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: nowIso,
          type: "help_resolved",
          title: `Help Request Resolved`,
          description: `Caregiver marked help request as resolved`,
        });
      }

      return {
        ...prev,
        helpRequests: requests,
        activityLogs: activities,
      };
    });

    return updated;
  }
}
