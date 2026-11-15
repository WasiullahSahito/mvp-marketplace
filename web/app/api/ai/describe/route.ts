// "Generate title and description from a product photo", using Ollama (a vision model).
// Runs on the server so OLLAMA_API_KEY never reaches the browser.
// If the key is missing (or there is no photo yet) it returns a clearly labelled demo suggestion instead,
// so the demo never breaks.
import { NextResponse } from "next/server";
import { getUserAndRole } from "@/lib/supabase/server";

const MOCK = {
  title: "Prague Divan Bed",
  description:
    "A sturdy divan bed with a soft fabric finish and a clean, modern look. Choose your size, storage and headboard to suit your room.",
  mock: true,
};

// Ollama Cloud by default. Set OLLAMA_BASE_URL=http://localhost:11434 to use a local Ollama instead.
const BASE_URL = process.env.OLLAMA_BASE_URL ?? "https://ollama.com";
const MODEL = process.env.OLLAMA_MODEL ?? "gemma4:31b"; // must be a vision model
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

  const hasKey = !!process.env.OLLAMA_API_KEY || !!process.env.OLLAMA_BASE_URL; // local Ollama needs no key
  if (!hasKey || !photoOk) {
    return NextResponse.json(MOCK);
  }

  try {
    // Ollama's REST API wants the image as base64, not a url, so download it first.
    const imageRes = await fetch(imageUrl!, { signal: AbortSignal.timeout(10_000) });
    if (!imageRes.ok) throw new Error(`Image download failed (${imageRes.status})`);
    const bytes = Buffer.from(await imageRes.arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "That photo is too large for the AI (max 5 MB)." }, { status: 422 });
    }

    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.OLLAMA_API_KEY ? { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        messages: [
          {
            role: "user",
            content:
              'You write product listings for an online furniture marketplace. Look at this product photo and write a short, honest title (max 70 characters) and a friendly description (2-3 sentences). Only mention what you can see. Reply with ONLY a JSON object like {"title": "...", "description": "..."} and nothing else.',
            images: [bytes.toString("base64")],
          },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      console.error("Ollama error:", res.status, (await res.text()).slice(0, 300));
      const message = res.status === 429 ? "The AI is busy. Please try again in a minute." : "The AI request failed. Please try again or write it yourself.";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const data = (await res.json()) as { message?: { content?: string } };
    const parsed = extractJson(data.message?.content ?? "");
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

// Ollama cloud models cannot force a JSON schema, so the model may wrap the JSON in text or ``` fences.
// Take the first {...} block and check it has the two strings we need.
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
