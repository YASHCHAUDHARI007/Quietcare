import { NextResponse } from "next/server";
import { QuietcareRepository } from "@/lib/server/repository";
import type { DoseStatus } from "@/types/quietcare";

export async function GET(
  _req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const dose = await QuietcareRepository.getDoseById(params.id);

    if (!dose) {
      return NextResponse.json(
        { success: false, error: "Dose not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: dose });
  } catch (error) {
    console.error("[API doses/[id] GET] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve dose" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const body = await req.json();
    const { status, source = "caregiver_ui" } = body;

    const validStatuses: DoseStatus[] = ["pending", "reminder_sent", "taken", "not_yet", "missed"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status: ${status}` },
        { status: 400 }
      );
    }

    const result = await QuietcareRepository.updateDoseStatus(
      params.id,
      status as DoseStatus,
      source
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "Dose not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, dose: result.dose });
  } catch (error) {
    console.error("[API doses/[id] PUT] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update dose" },
      { status: 500 }
    );
  }
}
