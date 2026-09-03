import { NextResponse } from "next/server";
import { calculateCoverage } from "@/lib/routine";
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
    const { language, breakfast, dinner } = body;

    const updatedState = await QuietcareRepository.updateState((prev) => {
      const coverage = calculateCoverage(prev.medicines);
      const chosenLang = language || prev.routine.language || "Marathi";
      const bTime = breakfast || prev.routine.breakfastTime || "8:00 am";
      const dTime = dinner || prev.routine.dinnerTime || "7:30 pm";

      const dosePacks = [
        {
          packetNumber: 1,
          timingLabel: "Before Breakfast",
          mealRelation: `30 mins before breakfast (${bTime})`,
          medicines: [
            { name: "Pantop 40mg", dose: "1 tablet", instruction: "Take with water" },
          ],
        },
        {
          packetNumber: 2,
          timingLabel: "After Breakfast",
          mealRelation: `Within 15 mins after breakfast (${bTime})`,
          medicines: [
            { name: "Vertin 2mg", dose: "1 tablet", instruction: "Do not crush" },
            { name: "Metformin 500mg", dose: "1 tablet", instruction: "Take after meal" },
          ],
        },
        {
          packetNumber: 3,
          timingLabel: "Before Dinner",
          mealRelation: `15 mins before dinner (${dTime})`,
          medicines: [
            { name: "Telma 40mg", dose: "1 tablet", instruction: "Blood pressure support" },
          ],
        },
        {
          packetNumber: 4,
          timingLabel: "After Dinner",
          mealRelation: `After dinner (${dTime}) before bedtime`,
          medicines: [
            { name: "Vertin 2mg", dose: "1 tablet", instruction: "Night dose" },
          ],
        },
      ];

      return {
        ...prev,
        patient: {
          ...prev.patient,
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
            description: `Configured meal timings (${bTime} / ${dTime}). ${coverage} days coverage ready.`,
          },
          ...prev.activityLogs,
        ],
      };
    });

    // Ensure today's doses are synced with meal times
    await ReminderService.syncTodayDosesFromRoutine();

    return NextResponse.json({
      success: true,
      routine: updatedState.routine,
      coverageDays: updatedState.routine.coverageDays,
    });
  } catch (error) {
    console.error("[API routine POST] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update routine" },
      { status: 500 }
    );
  }
}
