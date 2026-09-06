import { NextResponse } from "next/server";
import { ReminderService } from "@/lib/server/reminders";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { doseId } = body;

    const result = await ReminderService.triggerTestReminder(doseId);

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (error) {
    console.error("[API reminders/test] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to trigger reminder test" },
      { status: 500 }
    );
  }
}
