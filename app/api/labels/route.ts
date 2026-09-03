import { NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";

export async function GET() {
  try {
    const store = await getStore();
    const { routine, patient } = store;

    const labels = [
      {
        id: "label_1",
        pouchNumber: 1,
        imageFile: "before-breakfast.png",
        timing: "Before breakfast",
        time: routine.breakfastTime,
        marathiLabel: "सकाळच्या नाश्त्यापूर्वी",
        hindiLabel: "नाश्ते से पहले",
        patientName: patient.name,
        medicines: ["Pantop 40mg (1 tab)"],
        instructions: "Take with half glass warm water",
      },
      {
        id: "label_2",
        pouchNumber: 2,
        imageFile: "after-breakfast.png",
        timing: "After breakfast",
        time: routine.breakfastTime,
        marathiLabel: "सकाळच्या नाश्त्यानंतर",
        hindiLabel: "नाश्ते के बाद",
        patientName: patient.name,
        medicines: ["Vertin 2mg (1 tab)", "Metformin 500mg (1 tab)"],
        instructions: "Take within 15 minutes after food",
      },
      {
        id: "label_3",
        pouchNumber: 3,
        imageFile: "before-dinner.png",
        timing: "Before dinner",
        time: routine.dinnerTime,
        marathiLabel: "रात्रीच्या जेवणापूर्वी",
        hindiLabel: "रात के खाने से पहले",
        patientName: patient.name,
        medicines: ["Telma 40mg (1 tab)"],
        instructions: "Keep 15 minutes gap before meal",
      },
      {
        id: "label_4",
        pouchNumber: 4,
        imageFile: "after-dinner.png",
        timing: "After dinner",
        time: routine.dinnerTime,
        marathiLabel: "रात्रीच्या जेवणानंतर",
        hindiLabel: "रात के खाने के बाद",
        patientName: patient.name,
        medicines: ["Vertin 2mg (1 tab)"],
        instructions: "Take before sleeping",
      },
    ];

    return NextResponse.json({
      success: true,
      labels,
      totalPouches: labels.length,
      patientName: patient.name,
      preparedThrough: routine.preparedThrough,
      printablePdfUrl: "/api/labels/print",
    });
  } catch (error) {
    console.error("Error generating labels:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load labels" },
      { status: 500 }
    );
  }
}
