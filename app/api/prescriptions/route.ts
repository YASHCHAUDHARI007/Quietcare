import { NextResponse } from "next/server";
import { analyzePrescriptionWithGemini } from "@/lib/server/gemini";
import { QuietcareRepository } from "@/lib/server/repository";
import { ReminderService } from "@/lib/server/reminders";
import { calculateCoverage, generateDosePacks } from "@/lib/routine";
import type { PrescriptionRecord } from "@/types/quietcare";

export async function GET() {
  try {
    const state = await QuietcareRepository.getState();
    return NextResponse.json({
      success: true,
      data: state.prescriptions,
      count: state.prescriptions.length,
    });
  } catch (error) {
    console.error("[API prescriptions GET] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch prescriptions" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    let fileName = "prescription_upload.png";
    let base64Data: string | undefined;
    let mimeType = "image/jpeg";
    let fileSizeBytes = 0;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (file) {
        fileName = file.name;
        mimeType = file.type || "image/jpeg";
        fileSizeBytes = file.size;
        const buffer = await file.arrayBuffer();
        base64Data = Buffer.from(buffer).toString("base64");
      }
    } else {
      const json = await req.json().catch(() => ({}));
      if (json.fileName) fileName = json.fileName;
      if (json.base64Data) base64Data = json.base64Data;
      if (json.mimeType) mimeType = json.mimeType;
      if (json.fileSizeBytes) fileSizeBytes = Number(json.fileSizeBytes) || 0;
    }

    if (!base64Data) {
      return NextResponse.json(
        { success: false, error: "Please upload or capture a photo of the prescription." },
        { status: 400 }
      );
    }

    const ocrResult = await analyzePrescriptionWithGemini(
      base64Data,
      mimeType,
      fileSizeBytes
    );

    const hasUncertain = ocrResult.medicines.some((m) => m.uncertain);

    // Use base64 data for image preview
    const imageUrl = `data:${mimeType};base64,${base64Data}`;

    const newPrescription: PrescriptionRecord = {
      id: `rx_${Date.now()}`,
      fileName,
      doctorName: ocrResult.doctorName,
      clinic: ocrResult.clinic || "Cardiology & Geriatric Care Clinic",
      uploadedAt: new Date().toISOString(),
      courseDays: ocrResult.courseDays,
      medicinesFound: ocrResult.medicines.length,
      status: hasUncertain ? "review-needed" : "verified",
      imageUrl,
      ocrConfidence: ocrResult.confidence,
      ocrSource: ocrResult.source,
      uncertainNotice: ocrResult.uncertainItemNotice,
    };

    const updatedState = await QuietcareRepository.updateState((prev) => {
      const coverage = calculateCoverage(ocrResult.medicines);
      const dosePacks = generateDosePacks(
        ocrResult.medicines,
        prev.routine.breakfastTime,
        prev.routine.dinnerTime
      );

      return {
        ...prev,
        patient: {
          ...prev.patient,
          prescriptionName: ocrResult.patientName,
          courseDays: ocrResult.courseDays,
          availableDays: coverage,
        },
        medicines: ocrResult.medicines,
        routine: {
          ...prev.routine,
          coverageDays: coverage,
          dosePacks,
        },
        prescriptions: [newPrescription, ...prev.prescriptions],
        activityLogs: [
          {
            id: `act_${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: "prescription_analyzed",
            title: `Prescription processed (${fileName})`,
            description: `Identified ${ocrResult.medicines.length} medicines via Gemini 3.8 Flash multimodal AI`,
          },
          ...prev.activityLogs,
        ],
      };
    });

    await ReminderService.syncTodayDosesFromRoutine(false);

    return NextResponse.json({
      success: true,
      prescription: newPrescription,
      ocrResult,
      currentState: updatedState,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Failed to process prescription";
    console.error("[API prescriptions POST] Error:", error);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 400 }
    );
  }
}

