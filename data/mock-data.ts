import type { Medicine, PatientProfile } from "@/types/quietcare";

export const patient: PatientProfile = {
  id: "patient_primary",
  name: "",
  prescriptionName: "",
  courseDays: 0,
  availableDays: 0,
  preparedThrough: "",
  daysLeft: 0,
};

export const medicines: Medicine[] = [];

export const mealTimes = ["7:30 am", "8:00 am", "8:30 am", "9:00 am"];
export const dinnerTimes = ["7:00 pm", "7:30 pm", "8:00 pm", "8:30 pm"];
export const languages = ["Marathi", "Hindi", "English"];

