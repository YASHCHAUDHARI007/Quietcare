import { NextResponse } from "next/server";
import { TelegramService } from "@/lib/server/telegram";

/**
 * Inbound Telegram Webhook Handler.
 * Processes /start tokens and inline keyboard dose confirmations.
 */
export async function POST(req: Request) {
  try {
    const update = await req.json().catch(() => null);

    if (!update || typeof update !== "object") {
      return NextResponse.json(
        { success: false, error: "Invalid Telegram update payload" },
        { status: 400 }
      );
    }

    const result = await TelegramService.handleWebhookUpdate(update);

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    console.error("[Telegram Webhook] Error processing update:", error);
    // Return 200 OK so Telegram doesn't endlessly retry corrupted webhooks
    return NextResponse.json(
      { ok: false, error: "Internal webhook error" },
      { status: 200 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "active",
    message: "Quietcare Telegram webhook endpoint is online",
    timestamp: new Date().toISOString(),
  });
}
