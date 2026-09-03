import { NextResponse } from "next/server";
import { calculateCoverage, generateDosePacks } from "@/lib/routine";
import { QuietcareRepository } from "@/lib/server/repository";
import { ReminderService } from "@/lib/server/reminders";

export async function GET() {
  try {
    const store = await QuietcareRepository.getState();
    return NextResponse.json({
      success: true,
      routine: store.routine,
      patient: store.patient,
      coverageDays: store.routine.coverageDays,
    });
  } catch (error) {
    console.error("[API routine GET] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch routine" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { language, breakfast, dinner, patientName } = body;

    const updatedState = await QuietcareRepository.updateState((prev) => {
      const coverage = calculateCoverage(prev.medicines);
      const chosenLang = language || prev.routine.language || "Marathi";
      const bTime = breakfast || prev.routine.breakfastTime || "8:00 am";
      const dTime = dinner || prev.routine.dinnerTime || "7:30 pm";
      const name = patientName ? String(patientName).trim() : prev.patient.name;

      const dosePacks = generateDosePacks(prev.medicines, bTime, dTime);

      return {
        ...prev,
        patient: {
          ...prev.patient,
          name,
          availableDays: coverage,
          preparedThrough: `${coverage} days ahead`,
        },
        routine: {
          language: chosenLang,
          breakfastTime: bTime,
          dinnerTime: dTime,
          coverageDays: coverage,
          preparedThrough: `${coverage} days ahead`,
          dosePacks,
        },
        activityLogs: [
          {
            id: `act_${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: "routine_created",
            title: `Routine personalized (${chosenLang})`,
            description: `Configured meal timings (${bTime} / ${dTime}) for ${name}. ${coverage} days coverage ready.`,
          },
          ...prev.activityLogs,
        ],
      };
    });

    // Ensure today's doses are synced with updated meal times
    await ReminderService.syncTodayDosesFromRoutine(false);

    return NextResponse.json({
      success: true,
      routine: updatedState.routine,
      coverageDays: updatedState.routine.coverageDays,
      patientName: updatedState.patient.name,
    });
  } catch (error) {
    console.error("[API routine POST] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update routine" },
      { status: 500 }
    );
  }
}

