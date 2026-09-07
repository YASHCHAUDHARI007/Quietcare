import { NextRequest, NextResponse } from "next/server";
import { QuietcareRepository } from "@/lib/server/repository";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { username, password, role } = body || {};

    const rawUser = String(username || "").trim();
    const rawPass = String(password || "").trim();

    if (!rawUser || !rawPass) {
      return NextResponse.json(
        {
          ok: false,
          message: "Please enter your username and password to sign in.",
        },
        { status: 400 }
      );
    }

    // Hardcoded credentials: username "test" or "patient" with password "test"
    const isHardcodedTest =
      (rawUser.toLowerCase() === "test" || rawUser.toLowerCase() === "patient") &&
      rawPass === "test";

    // Optional environment variable configuration
    const configuredUser = process.env.CAREGIVER_USERNAME;
    const configuredPass = process.env.CAREGIVER_PASSWORD;
    const isEnvUser = Boolean(
      configuredUser &&
      configuredPass &&
      rawUser.toLowerCase() === configuredUser.toLowerCase() &&
      rawPass === configuredPass
    );

    if (!isHardcodedTest && !isEnvUser) {
      return NextResponse.json(
        { ok: false, message: "Invalid credentials. Please use username: test and password: test" },
        { status: 401 }
      );
    }

    const state = await QuietcareRepository.getState();
    const isPatientRole =
      role === "patient" ||
      rawUser.toLowerCase() === "patient";

    const resolvedRole = isPatientRole ? "patient" : "caregiver";

    const displayName = rawUser.includes("@")
      ? rawUser.split("@")[0]
      : rawUser;

    const formattedName = isPatientRole
      ? (state.patient.name || "Patient")
      : (displayName.charAt(0).toUpperCase() + displayName.slice(1) || "Caregiver");

    return NextResponse.json({
      ok: true,
      user: {
        username: rawUser,
        name: formattedName,
        role: resolvedRole,
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Authentication server error" },
      { status: 500 }
    );
  }
}


