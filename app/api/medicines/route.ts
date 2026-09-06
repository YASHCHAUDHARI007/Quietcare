import { NextResponse } from "next/server";
import { getStore, updateStore } from "@/lib/server/store";
import type { Medicine } from "@/types/quietcare";

export async function GET() {
  try {
    const store = await getStore();
    return NextResponse.json({
      success: true,
      data: store.medicines,
      count: store.medicines.length,
      uncertainCount: store.medicines.filter((m) => m.uncertain).length,
    });
  } catch (error) {
    console.error("Error fetching medicines:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch medicines" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, timing, timingConfirmed, quantity, days, name } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Medicine ID is required" },
        { status: 400 }
      );
    }

    const updatedState = await updateStore((prev) => {
      const updatedMedicines = prev.medicines.map((med) => {
        if (med.id === id || (name && med.name.toLowerCase() === name.toLowerCase())) {
          return {
            ...med,
            timing: timing !== undefined ? timing : med.timing,
            uncertain: timingConfirmed !== undefined ? !timingConfirmed : med.uncertain,
            quantity: quantity !== undefined ? Number(quantity) : med.quantity,
            days: days !== undefined ? Number(days) : med.days,
          };
        }
        return med;
      });

      return {
        ...prev,
        medicines: updatedMedicines,
        activityLogs: [
          {
            id: `act_${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: "stock_alert",
            title: `Updated ${name || id}`,
            description: timingConfirmed
              ? `Timing verified: ${timing || "Confirmed"}`
              : `Stock adjusted to ${quantity ?? "current"}`,
          },
          ...prev.activityLogs,
        ],
      };
    });

    return NextResponse.json({
      success: true,
      medicines: updatedState.medicines,
    });
  } catch (error) {
    console.error("Error updating medicine:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update medicine" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const newItems: Medicine[] = body.medicines || [];

    if (!Array.isArray(newItems) || newItems.length === 0) {
      return NextResponse.json(
        { success: false, error: "medicines array is required" },
        { status: 400 }
      );
    }

    const updatedState = await updateStore((prev) => ({
      ...prev,
      medicines: newItems,
    }));

    return NextResponse.json({
      success: true,
      medicines: updatedState.medicines,
    });
  } catch (error) {
    console.error("Error setting medicines:", error);
    return NextResponse.json(
      { success: false, error: "Failed to set medicines" },
      { status: 500 }
    );
  }
}
