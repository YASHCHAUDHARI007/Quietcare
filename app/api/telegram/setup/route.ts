import { NextResponse } from "next/server";
import { TelegramService } from "@/lib/server/telegram";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    let webhookUrl = body.webhookUrl;

    if (!webhookUrl) {
      // Derive from request host if not explicitly provided
      const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
      const proto = req.headers.get("x-forwarded-proto") || "https";
      if (host) {
        webhookUrl = `${proto}://${host}/api/telegram/webhook`;
      }
    }

    if (!webhookUrl) {
      return NextResponse.json(
        { success: false, error: "webhookUrl is required" },
        { status: 400 }
      );
    }

    const res = await TelegramService.setWebhook(webhookUrl);
    return NextResponse.json({
      success: res.success,
      webhookUrl,
      description: res.description,
    });
  } catch (error) {
    console.error("[API telegram/setup] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to configure Telegram webhook" },
      { status: 500 }
    );
  }
}
