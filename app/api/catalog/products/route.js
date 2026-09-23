import { NextResponse } from "next/server";
import { adminDb } from "@/lib/admin";
import { isSellable, publicProduct, serializeDoc } from "@/lib/productData";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await adminDb().collection("products").get();
    const products = snapshot.docs
      .map(serializeDoc)
      .filter(isSellable)
      .map(publicProduct)
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name));

    return NextResponse.json({ products });
  } catch (error) {
    console.error("catalog", error);
    return NextResponse.json({ products: [], error: "The catalogue is temporarily unavailable." }, { status: 503 });
  }
}

