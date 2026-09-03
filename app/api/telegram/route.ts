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
    const { action, patientId, doseId } = body;

    const state = await QuietcareRepository.getState();
    const effectivePatientId = patientId || state.patient.id || "patient_primary";

    if (action === "create" || action === "create_link") {
      const linkInfo = await TelegramService.createConnectLink(effectivePatientId);

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
