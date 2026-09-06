import type { Medicine, PatientProfile } from "@/types/quietcare";

export const patient: PatientProfile = {
  id: "meena",
  name: "Meena",
  prescriptionName: "Shobha Patil",
  courseDays: 10,
  availableDays: 7,
  preparedThrough: "10 sep",
  daysLeft: 5,
};

export const medicines: Medicine[] = [
  { id: "vertin", name: "Vertin 2mg", schedule: "1-0-1", timing: "After food", days: 3, quantity: 20, uncertain: true },
  { id: "metformin", name: "Metformin 500mg", schedule: "1-0-1", timing: "After food", days: 3, quantity: 20 },
  { id: "telma", name: "Telma 40mg", schedule: "1-0-1", timing: "After food", days: 3, quantity: 20 },
  { id: "pantop", name: "Pantop 40mg", schedule: "1-0-1", timing: "After food", days: 3, quantity: 20 },
];

export const mealTimes = ["7:30 am", "8:00 am", "8:30 am", "9:00 am"];
export const dinnerTimes = ["7:00 pm", "7:30 pm", "8:00 pm", "8:30 pm"];
export const languages = ["Marathi", "Hindi", "English"];
