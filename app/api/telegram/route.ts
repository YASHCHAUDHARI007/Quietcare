import { NextResponse } from "next/server";
import { getStore, updateStore } from "@/lib/server/store";

export async function GET() {
  try {
    const store = await getStore();
    return NextResponse.json({
      success: true,
      telegram: store.telegram,
      patientName: store.patient.name,
    });
  } catch (error) {
    console.error("Error fetching telegram state:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch telegram state" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    const token = `qc_${Math.random().toString(36).substring(2, 8)}`;
    const deepLink = `https://t.me/QuietcareReminderBot?start=${token}`;

    const updatedState = await updateStore((prev) => {
      const isConnected = action === "confirm" || action === "connected" ? true : prev.telegram.connected;

      return {
        ...prev,
        telegram: {
          ...prev.telegram,
          connected: isConnected,
          deepLink,
          parentName: prev.patient.name,
          lastReminderSent: action === "send_test_reminder"
            ? new Date().toISOString()
            : prev.telegram.lastReminderSent,
        },
        activityLogs: [
          {
            id: `act_${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: "telegram_connected",
            title: action === "send_test_reminder"
              ? "Test Telegram Reminder Sent"
              : isConnected
              ? `Connected ${prev.patient.name} on Telegram`
              : "Generated Telegram Connect Link",
            description: action === "send_test_reminder"
              ? `Sent dose reminder for ${prev.patient.name} via ${prev.telegram.botHandle}`
              : `Token: ${token}`,
          },
          ...prev.activityLogs,
        ],
      };
    });

    return NextResponse.json({
      success: true,
      telegram: updatedState.telegram,
      deepLink,
      message:
        action === "send_test_reminder"
          ? "Simulated reminder delivered to Telegram successfully"
          : "Telegram invite link created",
    });
  } catch (error) {
    console.error("Error updating telegram:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update telegram connection" },
      { status: 500 }
    );
  }
}
