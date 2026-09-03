import { NextResponse } from "next/server";
import { QuietcareRepository } from "@/lib/server/repository";
import type { HelpRequestStatus } from "@/types/quietcare";

export async function GET() {
  try {
    const helpRequests = await QuietcareRepository.getHelpRequests();
    const activeRequests = helpRequests.filter((r) => r.status === "active");

    return NextResponse.json({
      success: true,
      data: {
        helpRequests,
        activeRequests,
        activeCount: activeRequests.length,
        latestActive: activeRequests[0] || null,
      },
    });
  } catch (error) {
    console.error("[API help-requests GET] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve help requests" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { patientId = "patient_primary", message } = body;

    const newRequest = await QuietcareRepository.createHelpRequest(
      patientId,
      message
    );

    return NextResponse.json({
      success: true,
      data: newRequest,
    });
  } catch (error) {
    console.error("[API help-requests POST] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create help request" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: "id and status are required" },
        { status: 400 }
      );
    }

    const validStatuses: HelpRequestStatus[] = ["active", "acknowledged", "resolved"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const updated = await QuietcareRepository.updateHelpRequestStatus(
      id,
      status as HelpRequestStatus
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: `Help request ${id} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("[API help-requests PUT] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update help request status" },
      { status: 500 }
    );
  }
}
