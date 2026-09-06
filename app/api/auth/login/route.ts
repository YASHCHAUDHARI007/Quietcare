import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { username, password } = body || {};

    const rawUser = String(username || "").trim();
    const rawPass = String(password || "").trim();

    const lowerUser = rawUser.toLowerCase();
    const lowerPass = rawPass.toLowerCase();

    // 1. Standard demo credentials ("test" / "test", case-insensitive)
    // or empty credentials submitted for demo login
    if (
      (!rawUser && !rawPass) ||
      (lowerUser === "test" && lowerPass === "test") ||
      (lowerUser === "demo" && lowerPass === "demo")
    ) {
      return NextResponse.json({
        ok: true,
        user: {
          username: "test",
          name: "Caregiver Demo",
          role: "Caregiver",
        },
      });
    }

    // 2. Allow login with user's personal email or name (e.g. yashchaudhari478@gmail.com)
    if (rawUser.length > 0) {
      const displayName = rawUser.includes("@")
        ? rawUser.split("@")[0]
        : rawUser;
      return NextResponse.json({
        ok: true,
        user: {
          username: rawUser,
          name: displayName.charAt(0).toUpperCase() + displayName.slice(1),
          role: "Caregiver",
        },
      });
    }

    return NextResponse.json(
      {
        ok: false,
        message: "Please enter 'test' or your email to sign in.",
      },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { ok: false, message: "Authentication server error" },
      { status: 500 }
    );
  }
}

