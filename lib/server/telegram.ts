import { QuietcareRepository } from "./repository";
import type { Dose } from "@/types/quietcare";

const TELEGRAM_API_BASE = "https://api.telegram.org";

function getBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

export type TelegramBotInfo = {
  isConfigured: boolean;
  username: string;
  name: string;
  canJoinGroups?: boolean;
};

export class TelegramService {
  /**
   * Retrieves info about the current Telegram Bot.
   */
  static async getBotInfo(): Promise<TelegramBotInfo> {
    const token = getBotToken();
    if (!token) {
      return {
        isConfigured: false,
        username: "QuietcareReminderBot",
        name: "Quietcare Reminder Bot",
      };
    }

    try {
      const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/getMe`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        return {
          isConfigured: true,
          username: data.result.username || "QuietcareReminderBot",
          name: data.result.first_name || "Quietcare Reminder Bot",
          canJoinGroups: data.result.can_join_groups,
        };
      }
    } catch (err) {
      console.error("[TelegramService] Error calling getMe:", err);
    }

    return {
      isConfigured: true,
      username: "QuietcareReminderBot",
      name: "Quietcare Reminder Bot",
    };
  }

  /**
   * Send a standard text message to a Telegram chat.
   */
  static async sendMessage(
    chatId: number | string,
    text: string,
    replyMarkup?: Record<string, unknown>
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    const token = getBotToken();
    if (!token) {
      return {
        success: false,
        error: "TELEGRAM_BOT_TOKEN is not configured on the server",
      };
    }

    try {
      const body: Record<string, unknown> = {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      };

      if (replyMarkup) {
        body.reply_markup = replyMarkup;
      }

      const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        return { success: true, messageId: data.result.message_id };
      }

      return {
        success: false,
        error: data.description || "Failed to deliver message via Telegram API",
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      return { success: false, error: msg };
    }
  }

  /**
   * Acknowledge an inline button tap so the loading spinner on Telegram disappears.
   */
  static async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
    showAlert: boolean = false
  ): Promise<boolean> {
    const token = getBotToken();
    if (!token) return false;

    try {
      const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: text || "Quietcare response recorded",
          show_alert: showAlert,
        }),
      });
      const data = await res.json();
      return Boolean(res.ok && data.ok);
    } catch {
      return false;
    }
  }

  /**
   * Dispatches a real interactive dose reminder message to the parent's chat.
   */
  static async sendDoseReminder(
    chatId: number | string,
    dose: Dose,
    patientName: string = "Meena"
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    const message = `💊 <b>Medicine Reminder for ${patientName}</b>\n\n` +
      `<b>${dose.medicineName}</b> (${dose.doseAmount})\n` +
      `⏰ <b>Routine:</b> ${dose.timing} (${dose.scheduledTimeLabel})\n\n` +
      `Did you take your medicine?`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: "✅ Yes, I took it",
            callback_data: `dose:${dose.id}:taken`,
          },
          {
            text: "⏰ Not yet",
            callback_data: `dose:${dose.id}:not_yet`,
          },
        ],
      ],
    };

    const result = await this.sendMessage(chatId, message, inlineKeyboard);
    if (result.success) {
      await QuietcareRepository.updateDoseStatus(
        dose.id,
        "reminder_sent",
        "system",
        chatId
      );
      await QuietcareRepository.addActivityLog({
        type: "reminder_sent",
        title: `Reminder sent to Telegram`,
        description: `Delivered reminder for ${dose.medicineName} (${dose.scheduledTimeLabel}) to ${patientName}`,
      });
    }

    return result;
  }

  /**
   * Generates a secure, short-lived deep link for the parent to connect their Telegram.
   */
  static async createConnectLink(
    patientId: string = "patient_meena"
  ): Promise<{ token: string; deepLink: string; botUsername: string }> {
    const tokenRecord = await QuietcareRepository.createPendingToken(patientId);
    const botInfo = await this.getBotInfo();

    const deepLink = `https://t.me/${botInfo.username}?start=${tokenRecord.token}`;

    // Update repository state with new link
    await QuietcareRepository.updateState((prev) => ({
      ...prev,
      telegram: {
        ...prev.telegram,
        deepLink,
        botUsername: botInfo.username,
        botHandle: `@${botInfo.username}`,
      },
    }));

    return {
      token: tokenRecord.token,
      deepLink,
      botUsername: botInfo.username,
    };
  }

  /**
   * Configure Telegram webhook URL with Telegram Bot API servers.
   */
  static async setWebhook(
    webhookUrl: string
  ): Promise<{ success: boolean; description?: string }> {
    const token = getBotToken();
    if (!token) {
      return {
        success: false,
        description: "TELEGRAM_BOT_TOKEN is not configured on server",
      };
    }

    try {
      const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ["message", "callback_query"],
        }),
      });

      const data = await res.json();
      return {
        success: Boolean(res.ok && data.ok),
        description: data.description || "Webhook updated",
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      return { success: false, description: msg };
    }
  }

  /**
   * Main Webhook Processor: Handles inbound `/start <token>` and inline callbacks.
   */
  static async handleWebhookUpdate(
    update: Record<string, unknown>
  ): Promise<{
    success: boolean;
    action?: string;
    details?: unknown;
    chatId?: number;
    patientId?: string;
    doseId?: string;
  }> {
    // 1. Process Messages (e.g. /start <token>)
    if (update.message && typeof update.message === "object") {
      const msg = update.message as {
        chat?: { id: number; first_name?: string; username?: string };
        text?: string;
        from?: { id: number; first_name?: string; username?: string };
      };

      const chatId = msg.chat?.id;
      const text = (msg.text || "").trim();

      if (!chatId) {
        return { success: false, action: "no_chat_id" };
      }

      if (text.startsWith("/start")) {
        const parts = text.split(/\s+/);
        const token = parts[1]; // /start <token>

        if (!token) {
          await this.sendMessage(
            chatId,
            "💚 <b>Welcome to Quietcare</b>\n\n" +
              "To connect your medication reminders, please use the private link shared by your caregiver."
          );
          return { success: true, action: "start_without_token" };
        }

        const validToken = await QuietcareRepository.validateAndUsePendingToken(token);

        if (validToken) {
          const state = await QuietcareRepository.getState();
          await QuietcareRepository.connectTelegram(
            validToken.patientId,
            chatId,
            msg.from?.username || String(chatId)
          );

          await this.sendMessage(
            chatId,
            `💚 <b>Quietcare is connected!</b>\n\n` +
              `Hello ${state.patient.name}! I will remind you when it is time to take your daily medicines.\n\n` +
              `Your caregiver will also receive confirmation updates automatically.`
          );

          return {
            success: true,
            action: "connected_via_start",
            chatId,
            patientId: validToken.patientId,
          };
        } else {
          await this.sendMessage(
            chatId,
            "⚠️ <b>Quietcare Connection Link Expired</b>\n\n" +
              "This connection link has already been used or has expired. Please ask your caregiver to open Quietcare and generate a fresh link."
          );
          return { success: false, action: "token_invalid_or_expired" };
        }
      }

      if (text === "/status") {
        const state = await QuietcareRepository.getState();
        const pendingDoses = state.doses.filter((d) => d.status === "pending" || d.status === "reminder_sent");
        await this.sendMessage(
          chatId,
          `📋 <b>Quietcare Status</b>\n\n` +
            `Patient: <b>${state.patient.name}</b>\n` +
            `Remaining doses today: <b>${pendingDoses.length}</b>\n` +
            `Everything is running smoothly.`
        );
        return { success: true, action: "status_replied" };
      }
    }

    // 2. Process Callback Queries (Inline Button Taps)
    if (update.callback_query && typeof update.callback_query === "object") {
      const cb = update.callback_query as {
        id: string;
        from?: { id: number; first_name?: string };
        message?: { message_id: number; chat?: { id: number } };
        data?: string;
      };

      const cbId = cb.id;
      const data = cb.data || "";
      const chatId = cb.message?.chat?.id;

      if (!data.startsWith("dose:")) {
        await this.answerCallbackQuery(cbId, "Invalid request");
        return { success: false, action: "unknown_callback" };
      }

      // Expected format: dose:<doseId>:<status>
      const [, doseId, status] = data.split(":");

      const state = await QuietcareRepository.getState();
      const dose = state.doses.find((d) => d.id === doseId);

      if (!dose) {
        await this.answerCallbackQuery(cbId, "Dose record not found", true);
        return { success: false, action: "dose_not_found" };
      }

      if (status === "taken") {
        await QuietcareRepository.updateDoseStatus(
          doseId,
          "taken",
          "telegram",
          chatId
        );

        await this.answerCallbackQuery(
          cbId,
          `✅ Recorded! ${dose.medicineName} marked as taken.`
        );

        if (chatId) {
          await this.sendMessage(
            chatId,
            `✅ <b>Got it!</b> ${dose.medicineName} is marked as taken.\n\n` +
              `Your caregiver has been notified. Have a wonderful day 💚`
          );
        }

        return { success: true, action: "dose_taken", doseId };
      }

      if (status === "not_yet") {
        await QuietcareRepository.updateDoseStatus(
          doseId,
          "not_yet",
          "telegram",
          chatId
        );

        await this.answerCallbackQuery(
          cbId,
          `⏰ Got it. We'll remind you again in 15 minutes.`
        );

        if (chatId) {
          await this.sendMessage(
            chatId,
            `No problem 💚 I'll remind you again later for ${dose.medicineName}.`
          );
        }

        return { success: true, action: "dose_not_yet", doseId };
      }
    }

    return { success: true, action: "ignored" };
  }
}
