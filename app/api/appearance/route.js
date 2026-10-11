import { NextResponse } from "next/server";
import { adminDb } from "@/lib/admin";
import { normalizeTypography, TYPOGRAPHY_KEY } from "@/lib/typography.mjs";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const setting = await adminDb().collection("settings").doc(TYPOGRAPHY_KEY).get();
    return NextResponse.json({ typography: normalizeTypography(setting.data()?.value), configured: setting.exists }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Appearance settings are temporarily unavailable." }, { status: 503 });
  }
}
