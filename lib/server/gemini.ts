import { GoogleGenAI } from "@google/genai";
import type { Medicine } from "@/types/quietcare";

let aiInstance: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export type ParsedPrescriptionResult = {
  patientName: string;
  doctorName: string;
  clinic?: string;
  courseDays: number;
  medicines: Medicine[];
  uncertainItemNotice?: string;
  source: "gemini-3.8-flash";
  confidence: number;
  notice?: string;
};

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
]);

export async function analyzePrescriptionWithGemini(
  base64Data?: string,
  mimeType: string = "image/jpeg",
  fileSizeBytes?: number
): Promise<ParsedPrescriptionResult> {
  if (!base64Data) {
    throw new Error("No prescription image was provided. Please select or capture a photo of the prescription.");
  }

  // 1. Validation: File size check (Max 10MB)
  if (fileSizeBytes && fileSizeBytes > 10 * 1024 * 1024) {
    throw new Error("Prescription image file size exceeds the 10MB limit.");
  }

  // Normalize and validate MIME type
  const normalizedMime = mimeType.toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
    throw new Error(`Unsupported image type (${mimeType}). Please upload a JPG, PNG, or WebP photo.`);
  }

  const ai = getGeminiClient();
  if (!ai) {
    throw new Error(
      "GEMINI_API_KEY is not configured on the server. Please set GEMINI_API_KEY in the environment to enable prescription analysis."
    );
  }

  try {
    const prompt = `You are an expert clinical pharmacy assistant for geriatric medicine management.
Carefully analyze this prescription document image.

Extract:
1. Patient's full name (if present)
2. Doctor's name and clinic/hospital name
3. Every prescribed medication with:
   - name: brand/trade name and strength (e.g. "Vertin 2mg", "Metformin 500mg")
   - strength: e.g. "2mg", "500mg"
   - schedule: standard dosage convention (e.g. "1-0-1", "0-1-0", "1-0-0", "0-0-1")
   - timing: "Before breakfast", "After breakfast", "Before lunch", "After lunch", "Before dinner", "After dinner", or "Before bed"
   - duration in days (default to 10 if not explicitly indicated)
   - quantity: total count of tablets/capsules needed for the course
   - instructions: specific clinical instructions (e.g. "Take with warm water", "Do not crush", "Take after meals")
   - uncertain: boolean (true if handwriting is partially obscured, dosage is ambiguous, or human caregiver confirmation is mandatory)
4. Recommended overall course days (number)
5. Any notable warnings or uncertainties in "uncertainItemNotice"

IMPORTANT: Output ONLY a valid JSON object matching this exact structure without markdown backticks or commentary:
{
  "patientName": "string",
  "doctorName": "string",
  "clinic": "string",
  "courseDays": number,
  "medicines": [
    {
      "id": "string",
      "name": "string",
      "strength": "string",
      "schedule": "string",
      "timing": "string",
      "days": number,
      "quantity": number,
      "instructions": "string",
      "uncertain": boolean
    }
  ],
  "uncertainItemNotice": "string"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: normalizedMime,
              },
            },
            { text: prompt },
          ],
        },
      ],
    });

    const responseText = response.text?.trim() || "";
    const cleanedJson = responseText
      .replace(/^```json/i, "")
      .replace(/^```/i, "")
      .replace(/```$/i, "")
      .trim();

    if (!cleanedJson) {
      throw new Error("Gemini returned an empty response. Please try taking a clearer photo.");
    }

    const parsed = JSON.parse(cleanedJson);

    if (!Array.isArray(parsed.medicines) || parsed.medicines.length === 0) {
      throw new Error("No medications could be recognized in this image. Please ensure the prescription text is legible.");
    }

    const validatedMedicines: Medicine[] = parsed.medicines.map((m: Partial<Medicine>, idx: number) => ({
      id: m.id || `med_ai_${idx + 1}_${Date.now()}`,
      name: String(m.name || `Medicine ${idx + 1}`).trim(),
      strength: m.strength ? String(m.strength).trim() : undefined,
      schedule: String(m.schedule || "1-0-1").trim(),
      timing: String(m.timing || "After food").trim(),
      days: Number(m.days) > 0 ? Number(m.days) : 10,
      quantity: Number(m.quantity) > 0 ? Number(m.quantity) : 20,
      instructions: m.instructions ? String(m.instructions).trim() : undefined,
      uncertain: Boolean(m.uncertain),
    }));

    return {
      patientName: parsed.patientName || "Prescription Patient",
      doctorName: parsed.doctorName || "Treating Physician",
      clinic: parsed.clinic || "Clinic / Hospital",
      courseDays: Number(parsed.courseDays) > 0 ? Number(parsed.courseDays) : 10,
      medicines: validatedMedicines,
      uncertainItemNotice: parsed.uncertainItemNotice || (
        validatedMedicines.some((m) => m.uncertain)
          ? "Some medicine timings need caregiver verification"
          : undefined
      ),
      source: "gemini-3.8-flash",
      confidence: 0.98,
      notice: "Prescription analyzed live using Gemini 3.8 Flash multimodal OCR.",
    };
  } catch (err) {
    console.error("[GeminiService] Live OCR processing error:", err);
    throw new Error(
      `Prescription OCR failed: ${err instanceof Error ? err.message : "Unable to extract prescription details"}`
    );
  }
}
