import { NextResponse } from "next/server";
import { analyzePrescriptionWithGemini } from "@/lib/server/gemini";
import { getStore, updateStore } from "@/lib/server/store";
import type { PrescriptionRecord } from "@/types/quietcare";

export async function GET() {
  try {
    const store = await getStore();
    return NextResponse.json({
      success: true,
      data: store.prescriptions,
      count: store.prescriptions.length,
    });
  } catch (error) {
    console.error("Error fetching prescriptions:", error);
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

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (file) {
        fileName = file.name;
        mimeType = file.type || "image/jpeg";
        const buffer = await file.arrayBuffer();
        base64Data = Buffer.from(buffer).toString("base64");
      }
    } else {
      const json = await req.json().catch(() => ({}));
      if (json.fileName) fileName = json.fileName;
      if (json.base64Data) base64Data = json.base64Data;
      if (json.mimeType) mimeType = json.mimeType;
    }

    const ocrResult = await analyzePrescriptionWithGemini(base64Data, mimeType);

    const newPrescription: PrescriptionRecord = {
      id: `rx_${Date.now()}`,
      fileName,
      doctorName: ocrResult.doctorName,
      clinic: "Geriatric & Family Health Clinic",
      uploadedAt: new Date().toISOString(),
      courseDays: ocrResult.courseDays,
      medicinesFound: ocrResult.medicines.length,
      status: ocrResult.medicines.some((m) => m.uncertain)
        ? "review-needed"
        : "verified",
      imageUrl: "/assets/images/prescription.png",
      ocrConfidence: ocrResult.source === "gemini-3.8-flash" ? 0.98 : 0.92,
    };

    const updatedState = await updateStore((prev) => {
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
            type: "prescription_added",
            title: `Prescription uploaded (${fileName})`,
            description: `Identified ${ocrResult.medicines.length} medicines via ${ocrResult.source}`,
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
  } catch (error) {
    console.error("Error analyzing prescription:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process prescription" },
      { status: 500 }
    );
  }
}
