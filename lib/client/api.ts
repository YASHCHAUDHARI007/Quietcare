import type {
  Medicine,
  PrescriptionRecord,
  QuietcareAppState,
} from "@/types/quietcare";

export async function fetchAppState(): Promise<QuietcareAppState | null> {
  try {
    const res = await fetch("/api/state");
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch {
    return null;
  }
}

export async function uploadPrescriptionFile(file?: File): Promise<{
  success: boolean;
  medicines?: Medicine[];
  prescription?: PrescriptionRecord;
}> {
  try {
    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/prescriptions", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const json = await res.json();
        return {
          success: true,
          medicines: json.ocrResult?.medicines,
          prescription: json.prescription,
        };
      }
    } else {
      const res = await fetch("/api/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: "prescription.png" }),
      });
      if (res.ok) {
        const json = await res.json();
        return {
          success: true,
          medicines: json.ocrResult?.medicines,
          prescription: json.prescription,
        };
      }
    }
  } catch (err) {
    console.warn("API upload fallback:", err);
  }
  return { success: false };
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
  dinner: string
): Promise<{ success: boolean; coverageDays?: number }> {
  try {
    const res = await fetch("/api/routine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, breakfast, dinner }),
    });
    if (res.ok) {
      const json = await res.json();
      return { success: true, coverageDays: json.coverageDays };
    }
  } catch {
    // fallback
  }
  return { success: false };
}

export async function connectTelegram(
  action: "create" | "confirm" | "send_test_reminder" = "create"
): Promise<{ success: boolean; deepLink?: string }> {
  try {
    const res = await fetch("/api/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      const json = await res.json();
      return { success: true, deepLink: json.deepLink };
    }
  } catch {
    // fallback
  }
  return { success: false };
}
