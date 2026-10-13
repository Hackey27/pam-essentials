import {NextResponse} from "next/server";
import {adminDb} from "@/lib/admin";
import {CHECKOUT_KEY,SYNONYMS_KEY,normalizeCheckoutPreferences} from "@/lib/shopPreferences.mjs";
import {normalizedSynonyms} from "@/lib/friendlySearch.mjs";
export const dynamic="force-dynamic";
export async function GET(){try{const db=adminDb();const [checkout,synonyms]=await Promise.all([CHECKOUT_KEY,SYNONYMS_KEY].map((key)=>db.collection("settings").doc(key).get()));return NextResponse.json({checkout:normalizeCheckoutPreferences(checkout.data()?.value),synonyms:normalizedSynonyms(synonyms.data()?.value)},{headers:{"cache-control":"no-store"}});}catch{return NextResponse.json({error:"Store information could not be refreshed."},{status:503});}}
