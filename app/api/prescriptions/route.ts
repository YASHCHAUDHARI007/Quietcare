import { NextResponse } from "next/server";
import { analyzePrescriptionWithGemini } from "@/lib/server/gemini";
import { QuietcareRepository } from "@/lib/server/repository";
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

    const ocrResult = await analyzePrescriptionWithGemini(base64Data, mimeType, fileSizeBytes);

    const hasUncertain = ocrResult.medicines.some((m) => m.uncertain);

    const newPrescription: PrescriptionRecord = {
      id: `rx_${Date.now()}`,
      fileName,
      doctorName: ocrResult.doctorName,
      clinic: ocrResult.clinic || "Cardiology & Geriatric Care Clinic",
      uploadedAt: new Date().toISOString(),
      courseDays: ocrResult.courseDays,
      medicinesFound: ocrResult.medicines.length,
      status: hasUncertain ? "review-needed" : "verified",
      imageUrl: "/assets/images/prescription.png",
      ocrConfidence: ocrResult.confidence,
      ocrSource: ocrResult.source,
      uncertainNotice: ocrResult.uncertainItemNotice,
    };

    const updatedState = await QuietcareRepository.updateState((prev) => {
      const logSourceNotice =
        ocrResult.source === "gemini-3.8-flash"
          ? "via Gemini 3.8 Flash multimodal AI"
          : "using clinical demo fallback (API key not configured)";

      return {
        ...prev,
        patient: {
          ...prev.patient,
          prescriptionName: ocrResult.patientName,
          courseDays: ocrResult.courseDays,
        },
        medicines: ocrResult.medicines,
        prescriptions: [newPrescription, ...prev.prescriptions],
        activityLogs: [
          {
            id: `act_${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: "prescription_analyzed",
            title: `Prescription processed (${fileName})`,
            description: `Identified ${ocrResult.medicines.length} medicines ${logSourceNotice}`,
          },
          ...prev.activityLogs,
        ],
      };
    });

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
