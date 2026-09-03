import { NextResponse } from "next/server";
import { QuietcareRepository } from "@/lib/server/repository";
import { ReminderService } from "@/lib/server/reminders";
import { calculateCoverage, generateDosePacks } from "@/lib/routine";
import type { Medicine } from "@/types/quietcare";

export async function GET() {
  try {
    const state = await QuietcareRepository.getState();
    return NextResponse.json({
      success: true,
      data: state.medicines,
      count: state.medicines.length,
      uncertainCount: state.medicines.filter((m) => m.uncertain).length,
    });
  } catch (error) {
    console.error("[API medicines GET] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch medicines" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, name, strength, schedule, timing, timingConfirmed, quantity, days, instructions } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Medicine ID is required" },
        { status: 400 }
      );
    }

    const updatedState = await QuietcareRepository.updateState((prev) => {
      const updatedMedicines = prev.medicines.map((med) => {
        if (med.id === id || (name && med.name.toLowerCase() === name.toLowerCase())) {
          return {
            ...med,
            name: name !== undefined ? String(name).trim() : med.name,
            strength: strength !== undefined ? String(strength).trim() : med.strength,
            schedule: schedule !== undefined ? String(schedule).trim() : med.schedule,
            timing: timing !== undefined ? String(timing).trim() : med.timing,
            uncertain: timingConfirmed !== undefined ? !timingConfirmed : med.uncertain,
            quantity: quantity !== undefined ? Number(quantity) : med.quantity,
            days: days !== undefined ? Number(days) : med.days,
            instructions: instructions !== undefined ? String(instructions).trim() : med.instructions,
          };
        }
        return med;
      });

      const coverage = calculateCoverage(updatedMedicines);
      const dosePacks = generateDosePacks(
        updatedMedicines,
        prev.routine.breakfastTime,
        prev.routine.dinnerTime
      );

      return {
        ...prev,
        medicines: updatedMedicines,
        routine: {
          ...prev.routine,
          coverageDays: coverage,
          dosePacks,
        },
        patient: {
          ...prev.patient,
          availableDays: coverage,
        },
        activityLogs: [
          {
            id: `act_${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: "medicine_edited",
            title: `Updated medicine: ${name || id}`,
            description: timingConfirmed
              ? `Timing verified: ${timing || "Confirmed"}`
              : `Updated dosage & stock details (${quantity ?? "saved"} units)`,
          },
          ...prev.activityLogs,
        ],
      };
    });

    // Re-sync today's doses with the updated medicine details
    await ReminderService.syncTodayDosesFromRoutine(false);

    return NextResponse.json({
      success: true,
      medicines: updatedState.medicines,
    });
  } catch (error) {
    console.error("[API medicines PUT] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update medicine" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Case 1: Bulk replace or confirm full medicine list
    if (Array.isArray(body.medicines)) {
      const newItems: Medicine[] = body.medicines;

      const updatedState = await QuietcareRepository.updateState((prev) => {
        const coverage = calculateCoverage(newItems);
        const dosePacks = generateDosePacks(
          newItems,
          prev.routine.breakfastTime,
          prev.routine.dinnerTime
        );

        return {
          ...prev,
          medicines: newItems,
          routine: {
            ...prev.routine,
            coverageDays: coverage,
            dosePacks,
          },
          patient: {
            ...prev.patient,
            availableDays: coverage,
          },
          activityLogs: [
            {
              id: `act_${Date.now()}`,
              timestamp: new Date().toISOString(),
              type: "medicine_edited",
              title: "Medicines list verified",
              description: `Confirmed ${newItems.length} active medications`,
            },
            ...prev.activityLogs,
          ],
        };
      });

      // Re-sync today's doses
      await ReminderService.syncTodayDosesFromRoutine(false);

      return NextResponse.json({
        success: true,
        medicines: updatedState.medicines,
      });
    }

    // Case 2: Add single medicine
    const singleMed: Medicine = body.medicine || body;
    if (!singleMed.name) {
      return NextResponse.json(
        { success: false, error: "Medicine name is required" },
        { status: 400 }
      );
    }

    const newMed: Medicine = {
      id: singleMed.id || `med_${Date.now()}`,
      name: String(singleMed.name).trim(),
      strength: singleMed.strength ? String(singleMed.strength).trim() : undefined,
      schedule: singleMed.schedule ? String(singleMed.schedule).trim() : "1-0-1",
      timing: singleMed.timing ? String(singleMed.timing).trim() : "After food",
      days: Number(singleMed.days) || 10,
      quantity: Number(singleMed.quantity) || 20,
      instructions: singleMed.instructions ? String(singleMed.instructions).trim() : undefined,
      uncertain: Boolean(singleMed.uncertain),
    };

    const updatedState = await QuietcareRepository.updateState((prev) => {
      const combined = [...prev.medicines, newMed];
      const coverage = calculateCoverage(combined);
      const dosePacks = generateDosePacks(
        combined,
        prev.routine.breakfastTime,
        prev.routine.dinnerTime
      );

      return {
        ...prev,
        medicines: combined,
        routine: {
          ...prev.routine,
          coverageDays: coverage,
          dosePacks,
        },
        patient: {
          ...prev.patient,
          availableDays: coverage,
        },
        activityLogs: [
          {
            id: `act_${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: "medicine_edited",
            title: `Added medicine: ${newMed.name}`,
            description: `Scheduled as ${newMed.schedule} (${newMed.timing})`,
          },
          ...prev.activityLogs,
        ],
      };
    });

    await ReminderService.syncTodayDosesFromRoutine(false);

    return NextResponse.json({
      success: true,
      medicine: newMed,
      medicines: updatedState.medicines,
    });
  } catch (error) {
    console.error("[API medicines POST] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save medicines" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const idFromQuery = url.searchParams.get("id");
    let idToDelete = idFromQuery;

    if (!idToDelete) {
      const body = await req.json().catch(() => ({}));
      idToDelete = body.id;
    }

    if (!idToDelete) {
      return NextResponse.json(
        { success: false, error: "Medicine id is required for deletion" },
        { status: 400 }
      );
    }

    let deletedName = idToDelete;

    const updatedState = await QuietcareRepository.updateState((prev) => {
      const target = prev.medicines.find((m) => m.id === idToDelete);
      if (target) deletedName = target.name;

      const filtered = prev.medicines.filter((m) => m.id !== idToDelete);
      const coverage = calculateCoverage(filtered);
      const dosePacks = generateDosePacks(
        filtered,
        prev.routine.breakfastTime,
        prev.routine.dinnerTime
      );

      return {
        ...prev,
        medicines: filtered,
        routine: {
          ...prev.routine,
          coverageDays: coverage,
          dosePacks,
        },
        patient: {
          ...prev.patient,
          availableDays: coverage,
        },
        activityLogs: [
          {
            id: `act_${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: "medicine_edited",
            title: `Removed medicine: ${deletedName}`,
            description: `Removed from patient routine`,
          },
          ...prev.activityLogs,
        ],
      };
    });

    await ReminderService.syncTodayDosesFromRoutine(false);

    return NextResponse.json({
      success: true,
      medicines: updatedState.medicines,
      message: `Deleted medicine ${deletedName}`,
    });
  } catch (error) {
    console.error("[API medicines DELETE] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete medicine" },
      { status: 500 }
    );
  }
}

