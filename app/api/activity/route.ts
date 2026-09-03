import { NextResponse } from "next/server";
import { getStore, updateStore } from "@/lib/server/store";
import type { ActivityLog } from "@/types/quietcare";

export async function GET() {
  try {
    const store = await getStore();
    return NextResponse.json({
      success: true,
      logs: store.activityLogs,
      count: store.activityLogs.length,
    });
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch activity logs" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, description, type } = body;

    if (!title) {
      return NextResponse.json(
        { success: false, error: "Title is required" },
        { status: 400 }
      );
    }

    const newLog: ActivityLog = {
      id: `act_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: type || "dose_taken",
      title,
      description: description || "",
    };

    const updated = await updateStore((prev) => ({
      ...prev,
      activityLogs: [newLog, ...prev.activityLogs],
    }));

    return NextResponse.json({
      success: true,
      log: newLog,
      totalLogs: updated.activityLogs.length,
    });
  } catch (error) {
    console.error("Error creating activity log:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record activity" },
      { status: 500 }
    );
  }
}
