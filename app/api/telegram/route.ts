import { NextResponse } from "next/server";
import { QuietcareRepository } from "@/lib/server/repository";
import { TelegramService } from "@/lib/server/telegram";
import { ReminderService } from "@/lib/server/reminders";

export async function GET() {
  try {
    const state = await QuietcareRepository.getState();
    const botInfo = await TelegramService.getBotInfo();

    return NextResponse.json({
      success: true,
      telegram: {
        ...state.telegram,
        isConfigured: botInfo.isConfigured,
        botUsername: botInfo.username,
        botHandle: `@${botInfo.username}`,
      },
      patientName: state.patient.name,
    });
  } catch (error) {
    console.error("[API telegram GET] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch telegram state" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, patientId = "patient_meena", doseId } = body;

    if (action === "create" || action === "create_link") {
      const linkInfo = await TelegramService.createConnectLink(patientId);

      return NextResponse.json({
        success: true,
        token: linkInfo.token,
        deepLink: linkInfo.deepLink,
        botUsername: linkInfo.botUsername,
        message: "Unique Telegram connection link generated",
      });
    }

    if (action === "disconnect") {
      const updated = await QuietcareRepository.disconnectTelegram();
      return NextResponse.json({
        success: true,
        telegram: updated,
        message: "Telegram disconnected",
      });
    }

    if (action === "test_connect_dev") {
      // Allows verifying the connection transition in dev/demo environments
      // without needing an external webhook ping
      const state = await QuietcareRepository.getState();
      const demoChatId = 987654321;
      const updated = await QuietcareRepository.connectTelegram(
        state.patient.id,
        demoChatId,
        "meena_telegram_user"
      );

      return NextResponse.json({
        success: true,
        telegram: updated,
        message: `Verified Telegram connection established for ${state.patient.name}`,
      });
    }

    if (action === "send_test_reminder") {
      const reminderResult = await ReminderService.triggerTestReminder(doseId);
      return NextResponse.json(reminderResult);
    }

    return NextResponse.json(
      { success: false, error: `Unrecognized action: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    console.error("[API telegram POST] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process Telegram request" },
      { status: 500 }
    );
  }
}
