import { NextResponse } from "next/server";
import { getStore, resetStore, updateStore } from "@/lib/server/store";

export async function GET() {
  try {
    const state = await getStore();
    return NextResponse.json({ success: true, data: state });
  } catch (error) {
    console.error("Error retrieving state:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve state" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === "reset") {
      const reset = await resetStore();
      return NextResponse.json({
        success: true,
        message: "State reset to defaults",
        data: reset,
      });
    }

    if (body.patient) {
      const updated = await updateStore((prev) => ({
        ...prev,
        patient: { ...prev.patient, ...body.patient },
      }));
      return NextResponse.json({ success: true, data: updated });
    }

    const state = await getStore();
    return NextResponse.json({ success: true, data: state });
  } catch (error) {
    console.error("Error updating state:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update state" },
      { status: 500 }
    );
  }
}
