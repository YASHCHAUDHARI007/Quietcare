import { NextResponse } from "next/server";
import { QuietcareRepository } from "@/lib/server/repository";
import type { ActivityLog } from "@/types/quietcare";

export async function GET() {
  try {
    const store = await QuietcareRepository.getState();
    return NextResponse.json({
      success: true,
      logs: store.activityLogs,
      count: store.activityLogs.length,
    });
  } catch (error) {
    console.error("[API activity GET] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch activity logs" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, description, type = "dose_taken" } = body;

    if (!title) {
      return NextResponse.json(
        { success: false, error: "Title is required" },
        { status: 400 }
      );
    }

    const newLog: ActivityLog = await QuietcareRepository.addActivityLog({
      type,
      title,
      description: description || "",
    });

    const state = await QuietcareRepository.getState();

    return NextResponse.json({
      success: true,
      log: newLog,
      totalLogs: state.activityLogs.length,
    });
  } catch (error) {
    console.error("[API activity POST] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record activity" },
      { status: 500 }
    );
  }
}
