import { NextResponse } from "next/server";
import { QuietcareRepository } from "@/lib/server/repository";

export async function GET() {
  try {
    const state = await QuietcareRepository.getState();
    const isConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN);

    return NextResponse.json({
      success: true,
      connected: state.telegram.connected,
      botHandle: state.telegram.botHandle,
      botUsername: state.telegram.botUsername || "QuietcareReminderBot",
      deepLink: state.telegram.deepLink,
      parentName: state.patient.name,
      parentChatId: state.telegram.parentChatId,
      connectedAt: state.telegram.connectedAt,
      isConfigured,
    });
  } catch (error) {
    console.error("[API telegram/status] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to query Telegram status" },
      { status: 500 }
    );
  }
}
