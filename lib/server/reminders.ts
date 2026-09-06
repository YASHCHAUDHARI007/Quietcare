import { QuietcareRepository } from "./repository";
import { TelegramService } from "./telegram";
import type { Dose } from "@/types/quietcare";

export class ReminderService {
  /**
   * Generates a set of scheduled dose records for today based on active medicines and routine settings.
   */
  static async syncTodayDosesFromRoutine(): Promise<Dose[]> {
    const state = await QuietcareRepository.getState();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const datePrefix = `${year}-${month}-${day}`;

    // If doses already exist for today, keep them
    if (state.doses && state.doses.length > 0) {
      return state.doses;
    }

    const generatedDoses: Dose[] = [
      {
        id: `dose_${Date.now()}_bb`,
        medicineId: "pantop",
        medicineName: "Pantop 40mg",
        doseAmount: "1 tablet",
        patientId: state.patient.id,
        scheduledAt: `${datePrefix}T08:00:00Z`,
        scheduledTimeLabel: state.routine.breakfastTime || "8:00 AM",
        timing: "Before Breakfast",
        status: "pending",
        notes: "Take 30 mins before food",
      },
      {
        id: `dose_${Date.now()}_ab`,
        medicineId: "metformin",
        medicineName: "Metformin 500mg",
        doseAmount: "1 tablet",
        patientId: state.patient.id,
        scheduledAt: `${datePrefix}T08:30:00Z`,
        scheduledTimeLabel: "8:30 AM",
        timing: "After Breakfast",
        status: "pending",
        notes: "Take after breakfast with water",
      },
      {
        id: `dose_${Date.now()}_bd`,
        medicineId: "telma",
        medicineName: "Telma 40mg",
        doseAmount: "1 tablet",
        patientId: state.patient.id,
        scheduledAt: `${datePrefix}T19:30:00Z`,
        scheduledTimeLabel: state.routine.dinnerTime || "7:30 PM",
        timing: "Before Dinner",
        status: "pending",
        notes: "Blood pressure support dose",
      },
      {
        id: `dose_${Date.now()}_ad`,
        medicineId: "vertin",
        medicineName: "Vertin 2mg",
        doseAmount: "1 tablet",
        patientId: state.patient.id,
        scheduledAt: `${datePrefix}T21:00:00Z`,
        scheduledTimeLabel: "9:00 PM",
        timing: "After Dinner",
        status: "pending",
        notes: "Night dose before sleep",
      },
    ];

    await QuietcareRepository.updateState((prev) => ({
      ...prev,
      doses: generatedDoses,
    }));

    return generatedDoses;
  }

  /**
   * Triggers a reminder test for a specific dose or the next pending dose.
   */
  static async triggerTestReminder(
    doseId?: string
  ): Promise<{
    success: boolean;
    message: string;
    dose?: Dose;
    error?: string;
  }> {
    const state = await QuietcareRepository.getState();

    // 1. Check if Telegram is connected
    if (!state.telegram.connected || !state.telegram.parentChatId) {
      // Find or pick a sample dose to demonstrate
      const targetDose = doseId
        ? state.doses.find((d) => d.id === doseId)
        : state.doses.find((d) => d.status === "pending") || state.doses[0];

      return {
        success: false,
        message: "Telegram is not connected yet. Please connect parent on Telegram first to deliver reminders.",
        error: "TELEGRAM_NOT_CONNECTED",
        dose: targetDose,
      };
    }

    // 2. Locate target dose
    let targetDose = state.doses.find((d) => d.id === doseId);
    if (!targetDose) {
      targetDose = state.doses.find((d) => d.status === "pending") || state.doses[0];
    }

    if (!targetDose) {
      return {
        success: false,
        message: "No scheduled doses found in routine to remind.",
        error: "NO_DOSES_FOUND",
      };
    }

    // 3. Dispatch real Telegram message
    const sendResult = await TelegramService.sendDoseReminder(
      state.telegram.parentChatId,
      targetDose,
      state.patient.name
    );

    if (sendResult.success) {
      const refreshedDose = await QuietcareRepository.getDoseById(targetDose.id);
      return {
        success: true,
        message: `Interactive Telegram reminder delivered to ${state.patient.name} for ${targetDose.medicineName}!`,
        dose: refreshedDose || targetDose,
      };
    }

    return {
      success: false,
      message: `Failed to deliver Telegram reminder: ${sendResult.error || "Unknown error"}`,
      error: sendResult.error,
      dose: targetDose,
    };
  }

  /**
   * Check and escalate unconfirmed reminders into 'missed' state if past the grace window.
   */
  static async checkEscalations(maxAgeMinutes: number = 60): Promise<number> {
    const state = await QuietcareRepository.getState();
    const now = Date.now();
    let escalatedCount = 0;

    for (const dose of state.doses) {
      if (dose.status === "reminder_sent" && dose.reminderSentAt) {
        const sentTime = new Date(dose.reminderSentAt).getTime();
        const diffMinutes = (now - sentTime) / (1000 * 60);

        if (diffMinutes > maxAgeMinutes) {
          await QuietcareRepository.updateDoseStatus(
            dose.id,
            "missed",
            "system"
          );
          escalatedCount++;
        }
      }
    }

    return escalatedCount;
  }
}
