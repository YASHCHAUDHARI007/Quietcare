import { promises as fs } from "fs";
import path from "path";
import type {
  ActivityLog,
  Medicine,
  PatientProfile,
  PrescriptionRecord,
  QuietcareAppState,
  RoutineSchedule,
  TelegramConnection,
} from "@/types/quietcare";

const DATA_FILE_PATH = path.join(process.cwd(), "data", "quietcare-store.json");

const defaultPatient: PatientProfile = {
  name: "Meena",
  prescriptionName: "Shobha Patil",
  courseDays: 10,
  availableDays: 7,
  preparedThrough: "10 sep",
  daysLeft: 5,
};

const defaultMedicines: Medicine[] = [
  {
    id: "vertin",
    name: "Vertin 2mg",
    schedule: "1-0-1",
    timing: "After food",
    days: 3,
    quantity: 20,
    uncertain: true,
  },
  {
    id: "metformin",
    name: "Metformin 500mg",
    schedule: "1-0-1",
    timing: "After food",
    days: 3,
    quantity: 20,
  },
  {
    id: "telma",
    name: "Telma 40mg",
    schedule: "1-0-1",
    timing: "After food",
    days: 3,
    quantity: 20,
  },
  {
    id: "pantop",
    name: "Pantop 40mg",
    schedule: "1-0-1",
    timing: "After food",
    days: 3,
    quantity: 20,
  },
];

const defaultPrescriptions: PrescriptionRecord[] = [
  {
    id: "rx_demo_01",
    fileName: "Dr_Kulkarni_Cardio_Prescription.png",
    doctorName: "Dr. S. Kulkarni",
    clinic: "Cardiology & Geriatric Care Clinic",
    uploadedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    courseDays: 10,
    medicinesFound: 4,
    status: "review-needed",
    imageUrl: "/assets/images/prescription.png",
    ocrConfidence: 0.94,
  },
];

const defaultRoutine: RoutineSchedule = {
  language: "Marathi",
  breakfastTime: "8:00 am",
  dinnerTime: "7:30 pm",
  coverageDays: 7,
  preparedThrough: "10 sep",
  dosePacks: [
    {
      packetNumber: 1,
      timingLabel: "Before Breakfast",
      mealRelation: "30 mins before food",
      medicines: [
        { name: "Pantop 40mg", dose: "1 tablet", instruction: "Take with water" },
      ],
    },
    {
      packetNumber: 2,
      timingLabel: "After Breakfast",
      mealRelation: "Within 15 mins after breakfast",
      medicines: [
        { name: "Vertin 2mg", dose: "1 tablet", instruction: "Do not crush" },
        { name: "Metformin 500mg", dose: "1 tablet", instruction: "Take after meal" },
      ],
    },
    {
      packetNumber: 3,
      timingLabel: "Before Dinner",
      mealRelation: "15 mins before dinner",
      medicines: [
        { name: "Telma 40mg", dose: "1 tablet", instruction: "Blood pressure support" },
      ],
    },
    {
      packetNumber: 4,
      timingLabel: "After Dinner",
      mealRelation: "After dinner before bed",
      medicines: [
        { name: "Vertin 2mg", dose: "1 tablet", instruction: "Night dose" },
      ],
    },
  ],
};

const defaultTelegram: TelegramConnection = {
  connected: false,
  botHandle: "@QuietcareReminderBot",
  deepLink: "https://t.me/QuietcareReminderBot?start=qc_meena_7829",
  parentName: "Meena",
};

const defaultLogs: ActivityLog[] = [
  {
    id: "log_1",
    timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
    type: "dose_taken",
    title: "After Lunch dose logged",
    description: "Marked taken by caregiver at 2:30 PM",
  },
  {
    id: "log_2",
    timestamp: new Date(Date.now() - 3600000 * 8).toISOString(),
    type: "stock_alert",
    title: "Low stock warning",
    description: "Telma 40mg has ~4 days remaining",
  },
  {
    id: "log_3",
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
    type: "prescription_added",
    title: "Prescription scanned",
    description: "Found 4 medicines from Dr. S. Kulkarni slip",
  },
];

let cachedState: QuietcareAppState | null = null;

async function loadFromDisk(): Promise<QuietcareAppState> {
  try {
    const data = await fs.readFile(DATA_FILE_PATH, "utf-8");
    return JSON.parse(data) as QuietcareAppState;
  } catch {
    const initialState: QuietcareAppState = {
      patient: defaultPatient,
      medicines: defaultMedicines,
      prescriptions: defaultPrescriptions,
      routine: defaultRoutine,
      telegram: defaultTelegram,
      activityLogs: defaultLogs,
    };
    await saveToDisk(initialState);
    return initialState;
  }
}

async function saveToDisk(state: QuietcareAppState): Promise<void> {
  try {
    await fs.mkdir(path.dirname(DATA_FILE_PATH), { recursive: true });
    await fs.writeFile(DATA_FILE_PATH, JSON.stringify(state, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to write Quietcare state to disk:", error);
  }
}

export async function getStore(): Promise<QuietcareAppState> {
  if (!cachedState) {
    cachedState = await loadFromDisk();
  }
  return cachedState;
}

export async function updateStore(
  updater: (prev: QuietcareAppState) => QuietcareAppState
): Promise<QuietcareAppState> {
  const current = await getStore();
  const next = updater(current);
  cachedState = next;
  await saveToDisk(next);
  return next;
}

export async function resetStore(): Promise<QuietcareAppState> {
  const resetState: QuietcareAppState = {
    patient: defaultPatient,
    medicines: defaultMedicines,
    prescriptions: defaultPrescriptions,
    routine: defaultRoutine,
    telegram: defaultTelegram,
    activityLogs: defaultLogs,
  };
  cachedState = resetState;
  await saveToDisk(resetState);
  return resetState;
}
