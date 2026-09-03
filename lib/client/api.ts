import type {
  ActivityLog,
  Dose,
  DoseStatus,
  HelpRequest,
  HelpRequestStatus,
  Medicine,
  PrescriptionRecord,
  QuietcareAppState,
  TelegramConnection,
} from "@/types/quietcare";

export async function fetchAppState(): Promise<QuietcareAppState | null> {
  try {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch {
    return null;
  }
}

export type TodayDosesResponse = {
  doses: Dose[];
  stats: {
    total: number;
    taken: number;
    pending: number;
    reminderSent: number;
    missed: number;
    notYet: number;
  };
  lastDose: Dose | null;
  nextDose: Dose | null;
  patientName: string;
};

export async function fetchTodayDoses(): Promise<TodayDosesResponse | null> {
  try {
    const res = await fetch("/api/doses", { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch {
    return null;
  }
}

export async function updateDoseStatusApi(
  doseId: string,
  status: DoseStatus,
  source: "caregiver_ui" | "patient_ui" | "telegram" = "caregiver_ui"
): Promise<{ success: boolean; dose?: Dose; error?: string }> {
  try {
    const res = await fetch("/api/doses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doseId, status, source }),
    });
    const json = await res.json();
    return { success: res.ok && json.success, dose: json.dose, error: json.error };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : "Failed to update dose";
    return { success: false, error };
  }
}

export async function uploadPrescriptionFile(
  file: File
): Promise<{
  success: boolean;
  medicines?: Medicine[];
  prescription?: PrescriptionRecord;
  ocrResult?: {
    patientName: string;
    doctorName: string;
    clinic?: string;
    courseDays: number;
    source: string;
    confidence: number;
    notice?: string;
    uncertainItemNotice?: string;
  };
  error?: string;
}> {
  try {
    if (!file) {
      return { success: false, error: "Please select a prescription image to upload." };
    }
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/prescriptions", {
      method: "POST",
      body: formData,
    });
    const json = await res.json();
    if (res.ok && json.success) {
      return {
        success: true,
        medicines: json.ocrResult?.medicines,
        prescription: json.prescription,
        ocrResult: json.ocrResult,
      };
    }
    return { success: false, error: json.error || "OCR upload failed" };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : "Network error";
    return { success: false, error };
  }
}

export async function saveMedicinesList(
  medicines: Medicine[]
): Promise<{ success: boolean; medicines?: Medicine[]; error?: string }> {
  try {
    const res = await fetch("/api/medicines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ medicines }),
    });
    const json = await res.json();
    return {
      success: res.ok && json.success,
      medicines: json.medicines,
      error: json.error,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save medicines",
    };
  }
}

export async function createMedicine(
  medicine: Partial<Medicine>
): Promise<{ success: boolean; medicine?: Medicine; medicines?: Medicine[]; error?: string }> {
  try {
    const res = await fetch("/api/medicines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ medicine }),
    });
    const json = await res.json();
    return {
      success: res.ok && json.success,
      medicine: json.medicine,
      medicines: json.medicines,
      error: json.error,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to add medicine",
    };
  }
}

export async function updateMedicine(
  medicine: Partial<Medicine> & { id: string }
): Promise<{ success: boolean; medicines?: Medicine[]; error?: string }> {
  try {
    const res = await fetch("/api/medicines", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(medicine),
    });
    const json = await res.json();
    return {
      success: res.ok && json.success,
      medicines: json.medicines,
      error: json.error,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update medicine",
    };
  }
}

export async function deleteMedicine(
  id: string
): Promise<{ success: boolean; medicines?: Medicine[]; error?: string }> {
  try {
    const res = await fetch(`/api/medicines?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const json = await res.json();
    return {
      success: res.ok && json.success,
      medicines: json.medicines,
      error: json.error,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete medicine",
    };
  }
}

export async function updateMedicineTiming(
  id: string,
  timing: string,
  confirmed: boolean = true
): Promise<boolean> {
  try {
    const res = await fetch("/api/medicines", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        timing,
        timingConfirmed: confirmed,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function updateMedicineQuantity(
  id: string,
  quantity: number
): Promise<boolean> {
  try {
    const res = await fetch("/api/medicines", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, quantity }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function saveRoutineSettings(
  language: string,
  breakfast: string,
  dinner: string,
  patientName?: string
): Promise<{ success: boolean; coverageDays?: number; patientName?: string; error?: string }> {
  try {
    const res = await fetch("/api/routine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, breakfast, dinner, patientName }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      return {
        success: true,
        coverageDays: json.coverageDays,
        patientName: json.patientName,
      };
    }
    return { success: false, error: json.error || "Failed to save routine" };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error saving routine",
    };
  }
}

export async function fetchTelegramStatus(): Promise<{
  connected: boolean;
  botHandle: string;
  botUsername: string;
  deepLink: string;
  parentName: string;
  isConfigured: boolean;
  connectedAt?: string;
} | null> {
  try {
    const res = await fetch("/api/telegram/status", { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function connectTelegram(
  action: "create" | "disconnect" | "send_test_reminder" = "create"
): Promise<{
  success: boolean;
  deepLink?: string;
  telegram?: TelegramConnection;
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch("/api/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await res.json();
    return {
      success: res.ok && json.success,
      deepLink: json.deepLink,
      telegram: json.telegram,
      message: json.message,
      error: json.error,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : "Connection error";
    return { success: false, error };
  }
}

export async function triggerTestDoseReminder(
  doseId?: string
): Promise<{
  success: boolean;
  message: string;
  dose?: Dose;
  error?: string;
}> {
  try {
    const res = await fetch("/api/reminders/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doseId }),
    });
    const json = await res.json();
    return {
      success: json.success,
      message: json.message || (res.ok ? "Reminder dispatched" : "Failed to dispatch reminder"),
      dose: json.dose,
      error: json.error,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : "Network error";
    return {
      success: false,
      message: error,
      error,
    };
  }
}

export async function recordActivity(
  title: string,
  description?: string,
  type: ActivityLog["type"] = "dose_taken"
): Promise<boolean> {
  try {
    const res = await fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, type }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function resetBackendState(): Promise<boolean> {
  try {
    const res = await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type HelpRequestsResponse = {
  helpRequests: HelpRequest[];
  activeRequests: HelpRequest[];
  activeCount: number;
  latestActive: HelpRequest | null;
};

export async function fetchHelpRequests(): Promise<HelpRequestsResponse | null> {
  try {
    const res = await fetch("/api/help-requests", { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch {
    return null;
  }
}

export async function createHelpRequestApi(
  message?: string
): Promise<{ success: boolean; data?: HelpRequest; error?: string }> {
  try {
    const res = await fetch("/api/help-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const json = await res.json();
    return { success: res.ok && json.success, data: json.data, error: json.error };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : "Failed to create help request";
    return { success: false, error };
  }
}

export async function updateHelpRequestStatusApi(
  id: string,
  status: HelpRequestStatus
): Promise<{ success: boolean; data?: HelpRequest; error?: string }> {
  try {
    const res = await fetch("/api/help-requests", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const json = await res.json();
    return { success: res.ok && json.success, data: json.data, error: json.error };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : "Failed to update help request";
    return { success: false, error };
  }
}

