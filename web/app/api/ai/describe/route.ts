// "Generate title and description from a product photo", using Google Gemini (a vision model).
// Runs on the server so GEMINI_API_KEY never reaches the browser.
// If the key is missing, there is no photo yet, or the AI is out of quota, it returns a clearly labelled
// demo suggestion instead, so the form never breaks.
import { NextResponse } from "next/server";
import { getUserAndRole } from "@/lib/supabase/server";

const MOCK = {
  title: "Prague Divan Bed",
  description:
    "A sturdy divan bed with a soft fabric finish and a clean, modern look. Choose your size, storage and headboard to suit your room.",
  mock: true,
};

// `||` (not `??`) so an empty line like `GEMINI_MODEL=` in .env also falls back to the default.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite"; // must accept images
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  // Only logged-in sellers may use it (it costs money).
  const { user, role } = await getUserAndRole();
  if (!user || (role !== "seller" && role !== "admin")) {
    return NextResponse.json({ error: "Please log in as a seller." }, { status: 401 });
  }

  const { imageUrl } = (await request.json().catch(() => ({}))) as { imageUrl?: string | null };

  // Only accept photos that were uploaded to OUR storage bucket (stops people using this route to fetch other sites).
  const allowedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/`;
  const photoOk = typeof imageUrl === "string" && imageUrl.startsWith(allowedPrefix);

  // `reason` tells the form why it got a demo suggestion, so the note can be accurate.
  if (!photoOk) return NextResponse.json({ ...MOCK, reason: "no_photo" });
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ ...MOCK, reason: "no_key" });

  try {
    // Send the photo as base64, so download it first.
    const imageRes = await fetch(imageUrl!, { signal: AbortSignal.timeout(10_000) });
    if (!imageRes.ok) throw new Error(`Image download failed (${imageRes.status})`);
    const bytes = Buffer.from(await imageRes.arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "That photo is too large for the AI (max 5 MB)." }, { status: 422 });
    }
    const mimeType = (imageRes.headers.get("content-type") ?? "image/jpeg").split(";")[0];

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "You write product listings for an online furniture marketplace. Look at this product photo and write a short, honest title (max 70 characters) and a friendly description (2-3 sentences). Only mention what you can see. Reply with ONLY a JSON object like {\"title\": \"...\", \"description\": \"...\"}.",
              },
              { inline_data: { mime_type: mimeType, data: bytes.toString("base64") } },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      console.error("Gemini error:", res.status, (await res.text()).slice(0, 300));
      // Out of quota / too busy: fall back to the labelled demo suggestion so the form still works.
      if (res.status === 429) return NextResponse.json({ ...MOCK, reason: "unavailable" });
      return NextResponse.json({ error: "The AI request failed. Please try again or write it yourself." }, { status: 502 });
    }

    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const parsed = extractJson(text);
    if (!parsed) {
      return NextResponse.json({ error: "The AI gave an unreadable answer. Please try again or write it yourself." }, { status: 502 });
    }
    return NextResponse.json({ title: parsed.title.slice(0, 120), description: parsed.description, mock: false });
  } catch (e) {
    // Never leak details; log on the server only.
    console.error("AI describe failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "The AI request failed. Please try again or write it yourself." }, { status: 502 });
  }
}

// The model should return pure JSON, but be forgiving: take the first {...} block and check it has the two strings we need.
function extractJson(text: string): { title: string; description: string } | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1));
    if (typeof obj.title === "string" && typeof obj.description === "string" && obj.title.trim()) {
      return { title: obj.title.trim(), description: obj.description.trim() };
    }
  } catch {}
  return null;
}
