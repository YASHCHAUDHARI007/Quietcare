import { NextResponse } from "next/server";
import { QuietcareRepository } from "@/lib/server/repository";
import type { DoseStatus } from "@/types/quietcare";

export async function GET() {
  try {
    const doses = await QuietcareRepository.getTodayDoses();
    const state = await QuietcareRepository.getState();

    // Calculate dynamically:
    // Last dose: the most recently taken dose
    const takenDoses = doses.filter((d) => d.status === "taken" && d.takenAt);
    takenDoses.sort((a, b) => (b.takenAt || "").localeCompare(a.takenAt || ""));
    const lastDose = takenDoses[0] || null;

    // Next dose: the next pending or reminder_sent dose
    const upcomingDoses = doses.filter((d) => d.status === "pending" || d.status === "reminder_sent");
    upcomingDoses.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    const nextDose = upcomingDoses[0] || null;

    const stats = {
      total: doses.length,
      taken: doses.filter((d) => d.status === "taken").length,
      pending: doses.filter((d) => d.status === "pending").length,
      reminderSent: doses.filter((d) => d.status === "reminder_sent").length,
      missed: doses.filter((d) => d.status === "missed").length,
      notYet: doses.filter((d) => d.status === "not_yet").length,
    };

    return NextResponse.json({
      success: true,
      data: {
        doses,
        stats,
        lastDose,
        nextDose,
        patientName: state.patient.name,
      },
    });
  } catch (error) {
    console.error("[API doses GET] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve doses" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { doseId, status, source = "caregiver_ui" } = body;

    if (!doseId || !status) {
      return NextResponse.json(
        { success: false, error: "doseId and status are required" },
        { status: 400 }
      );
    }

    const validStatuses: DoseStatus[] = ["pending", "reminder_sent", "taken", "not_yet", "missed"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status: ${status}. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const result = await QuietcareRepository.updateDoseStatus(
      doseId,
      status as DoseStatus,
      source
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: `Dose with id ${doseId} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      dose: result.dose,
    });
  } catch (error) {
    console.error("[API doses PUT] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update dose status" },
      { status: 500 }
    );
  }
}
