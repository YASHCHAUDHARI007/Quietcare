import { NextResponse } from "next/server";
import { QuietcareRepository } from "@/lib/server/repository";

export async function GET() {
  try {
    const state = await QuietcareRepository.getState();
    return NextResponse.json({ success: true, data: state });
  } catch (error) {
    console.error("[API state GET] Error:", error);
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
      const reset = await QuietcareRepository.resetState();
      return NextResponse.json({
        success: true,
        message: "State reset to defaults",
        data: reset,
      });
    }

    if (body.patient) {
      const updated = await QuietcareRepository.updateState((prev) => ({
        ...prev,
        patient: { ...prev.patient, ...body.patient },
      }));
      return NextResponse.json({ success: true, data: updated });
    }

    const state = await QuietcareRepository.getState();
    return NextResponse.json({ success: true, data: state });
  } catch (error) {
    console.error("[API state POST] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update state" },
      { status: 500 }
    );
  }
}
