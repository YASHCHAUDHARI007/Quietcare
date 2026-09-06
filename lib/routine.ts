import type { Dose, Medicine, RoutineSchedule } from "@/types/quietcare";
import { createISTIsoString, getISTDateParts } from "@/lib/timezone";

/**
 * Calculates daily pill requirement from dosage convention (e.g., "1-0-1" = 2/day, "1-1-1" = 3/day).
 */
export function calculateDailyFrequency(schedule: string): number {
  if (!schedule) return 1;
  const parts = schedule.split("-").map((s) => parseInt(s.trim(), 10));
  const sum = parts.reduce((acc, val) => acc + (isNaN(val) ? 0 : val), 0);
  return sum > 0 ? sum : 1;
}

/**
 * Computes coverage in days based on lowest medicine inventory count.
 */
export function calculateCoverage(items: Medicine[]): number {
  if (!items || items.length === 0) return 7;
  const daysPerMed = items.map((medicine) => {
    const dailyFreq = calculateDailyFrequency(medicine.schedule);
    const qty = Number(medicine.quantity) || 0;
    return Math.floor(qty / dailyFreq);
  });
  const minDays = Math.min(...daysPerMed);
  return Math.max(1, isFinite(minDays) ? minDays : 7);
}

/**
 * Parses time strings like "8:00 am", "8:30 AM", "7:30 pm", "20:00" into hour & minute.
 */
export function parseMealTime(
  timeStr: string = "",
  defaultHour: number = 8,
  defaultMin: number = 0
): { hour: number; minute: number } {
  const clean = timeStr.trim().toLowerCase();
  const isPm = clean.includes("pm");
  const isAm = clean.includes("am");
  const numOnly = clean.replace(/[^\d:]/g, "");
  const [hStr, mStr] = numOnly.split(":");
  let hour = parseInt(hStr, 10);
  const minute = parseInt(mStr, 10) || 0;

  if (isNaN(hour)) {
    return { hour: defaultHour, minute: defaultMin };
  }

  if (isPm && hour < 12) hour += 12;
  if (isAm && hour === 12) hour = 0;

  return { hour, minute };
}

/**
 * Formats 24-hour hour & minute into standard 12-hour display string (e.g. "8:00 AM").
 */
export function formatTimeLabel(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const displayMin = String(minute).padStart(2, "0");
  return `${displayHour}:${displayMin} ${period}`;
}

export type SlotDefinition = {
  key: "before_breakfast" | "after_breakfast" | "before_dinner" | "after_dinner";
  timingLabel: string;
  mealRelationTemplate: (bTime: string, dTime: string) => string;
  calcTime: (bTime: string, dTime: string) => { hour: number; minute: number };
  matchesMedicine: (med: Medicine) => boolean;
};

export const STANDARD_SLOTS: SlotDefinition[] = [
  {
    key: "before_breakfast",
    timingLabel: "Before Breakfast",
    mealRelationTemplate: (bTime) => `30 mins before breakfast (${bTime})`,
    calcTime: (bTime) => {
      const { hour, minute } = parseMealTime(bTime, 8, 0);
      const totalMin = hour * 60 + minute - 30;
      const h = Math.floor(Math.max(0, totalMin) / 60);
      const m = Math.max(0, totalMin) % 60;
      return { hour: h, minute: m };
    },
    matchesMedicine: (med) => {
      const t = (med.timing || "").toLowerCase();
      const s = (med.schedule || "").trim();
      if (t.includes("before breakfast")) return true;
      if (t.includes("empty stomach")) return true;
      if (t.includes("before food") && (s === "1-0-0" || s.startsWith("1"))) return true;
      return false;
    },
  },
  {
    key: "after_breakfast",
    timingLabel: "After Breakfast",
    mealRelationTemplate: (bTime) => `Within 15 mins after breakfast (${bTime})`,
    calcTime: (bTime) => {
      const { hour, minute } = parseMealTime(bTime, 8, 0);
      const totalMin = hour * 60 + minute + 30;
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      return { hour: h, minute: m };
    },
    matchesMedicine: (med) => {
      const t = (med.timing || "").toLowerCase();
      const s = (med.schedule || "").trim();
      if (t.includes("after breakfast")) return true;
      if (t.includes("after food") && s.startsWith("1")) return true;
      if (t.includes("morning") && !t.includes("before")) return true;
      return false;
    },
  },
  {
    key: "before_dinner",
    timingLabel: "Before Dinner",
    mealRelationTemplate: (_, dTime) => `15 mins before dinner (${dTime})`,
    calcTime: (_, dTime) => {
      const { hour, minute } = parseMealTime(dTime, 19, 30);
      const totalMin = hour * 60 + minute - 15;
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      return { hour: h, minute: m };
    },
    matchesMedicine: (med) => {
      const t = (med.timing || "").toLowerCase();
      const s = (med.schedule || "").trim();
      if (t.includes("before dinner")) return true;
      if (t.includes("before food") && (s.endsWith("1") || s === "0-0-1")) return true;
      return false;
    },
  },
  {
    key: "after_dinner",
    timingLabel: "After Dinner",
    mealRelationTemplate: (_, dTime) => `After dinner (${dTime}) before bedtime`,
    calcTime: (_, dTime) => {
      const { hour, minute } = parseMealTime(dTime, 19, 30);
      const totalMin = hour * 60 + minute + 45;
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      return { hour: h, minute: m };
    },
    matchesMedicine: (med) => {
      const t = (med.timing || "").toLowerCase();
      const s = (med.schedule || "").trim();
      if (t.includes("after dinner") || t.includes("bed") || t.includes("night")) return true;
      if (t.includes("after food") && (s.endsWith("1") || s === "0-0-1")) return true;
      return false;
    },
  },
];

/**
 * Generates dynamic dose packets for the routine from the actual medicines list.
 */
export function generateDosePacks(
  medicines: Medicine[],
  breakfastTime: string = "8:00 am",
  dinnerTime: string = "7:30 pm"
): RoutineSchedule["dosePacks"] {
  const packs: RoutineSchedule["dosePacks"] = [];
  let packetNum = 1;

  for (const slot of STANDARD_SLOTS) {
    const matchingMeds = medicines.filter(slot.matchesMedicine);
    if (matchingMeds.length > 0) {
      packs.push({
        packetNumber: packetNum++,
        timingLabel: slot.timingLabel,
        mealRelation: slot.mealRelationTemplate(breakfastTime, dinnerTime),
        medicines: matchingMeds.map((m) => ({
          name: m.name,
          dose: "1 tablet",
          instruction: m.instructions || m.timing || "Take with water",
        })),
      });
    }
  }

  // Fallback if none matched (e.g. empty or unconventional tags)
  if (packs.length === 0 && medicines.length > 0) {
    packs.push({
      packetNumber: 1,
      timingLabel: "Morning",
      mealRelation: `At breakfast (${breakfastTime})`,
      medicines: medicines.slice(0, 2).map((m) => ({
        name: m.name,
        dose: "1 tablet",
        instruction: m.instructions || "Take with water",
      })),
    });
    if (medicines.length > 2) {
      packs.push({
        packetNumber: 2,
        timingLabel: "Evening",
        mealRelation: `At dinner (${dinnerTime})`,
        medicines: medicines.slice(2).map((m) => ({
          name: m.name,
          dose: "1 tablet",
          instruction: m.instructions || "Take with water",
        })),
      });
    }
  }

  return packs;
}

/**
 * Synchronizes today's Dose records from the active medicines and routine.
 * Retains existing dose status (taken/missed/pending) if already recorded for today.
 */
export function generateDosesForRoutine(
  medicines: Medicine[],
  routine: RoutineSchedule,
  patientId: string = "patient_meena",
  existingDoses: Dose[] = []
): Dose[] {
  const { datePrefix } = getISTDateParts();

  const bTime = routine.breakfastTime || "8:00 am";
  const dTime = routine.dinnerTime || "7:30 pm";

  const doses: Dose[] = [];

  for (const slot of STANDARD_SLOTS) {
    const slotTime = slot.calcTime(bTime, dTime);
    const timeLabel = formatTimeLabel(slotTime.hour, slotTime.minute);
    const scheduledAt = createISTIsoString(datePrefix, slotTime.hour, slotTime.minute);

    const matchingMeds = medicines.filter(slot.matchesMedicine);

    for (const med of matchingMeds) {
      const doseId = `dose_${med.id}_${slot.key}`;

      // Check if this dose was already recorded today
      const existing = existingDoses.find(
        (d) => d.id === doseId || (d.medicineId === med.id && d.timing === slot.timingLabel)
      );

      doses.push({
        id: doseId,
        medicineId: med.id,
        medicineName: med.name,
        doseAmount: "1 tablet",
        patientId,
        scheduledAt,
        scheduledTimeLabel: timeLabel,
        timing: slot.timingLabel,
        status: existing?.status || "pending",
        takenAt: existing?.takenAt,
        reminderSentAt: existing?.reminderSentAt,
        followUpSentAt: existing?.followUpSentAt,
        telegramMessageId: existing?.telegramMessageId,
        notes: med.instructions || med.timing || "Take with water",
      });
    }
  }

  // If no doses generated (e.g. empty medicines list), return empty or existing
  if (doses.length === 0 && medicines.length > 0) {
    return medicines.map((med, idx) => ({
      id: `dose_${med.id}_morning`,
      medicineId: med.id,
      medicineName: med.name,
      doseAmount: "1 tablet",
      patientId,
      scheduledAt: createISTIsoString(datePrefix, 8, 30),
      scheduledTimeLabel: "8:30 AM",
      timing: "Morning",
      status: existingDoses[idx]?.status || "pending",
      takenAt: existingDoses[idx]?.takenAt,
      notes: med.instructions || "Take with water",
    }));
  }

  return doses;
}

