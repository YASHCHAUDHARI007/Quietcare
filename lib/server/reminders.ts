import { QuietcareRepository } from "./repository";
import { TelegramService } from "./telegram";
import { generateDosesForRoutine } from "@/lib/routine";
import type { Dose } from "@/types/quietcare";

export class ReminderService {
  /**
   * Generates a set of scheduled dose records for today based on active medicines and routine settings.
   */
  static async syncTodayDosesFromRoutine(forceRegenerate: boolean = false): Promise<Dose[]> {
    const state = await QuietcareRepository.getState();

    const syncedDoses = generateDosesForRoutine(
      state.medicines || [],
      state.routine,
      state.patient?.id || "patient_meena",
      forceRegenerate ? [] : (state.doses || [])
    );

    await QuietcareRepository.updateState((prev) => ({
      ...prev,
      doses: syncedDoses,
    }));

    return syncedDoses;
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
