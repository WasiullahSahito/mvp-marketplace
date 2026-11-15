// "Generate title and description from a product photo".
// Runs on the server so ANTHROPIC_API_KEY never reaches the browser.
// If the key is missing (or there is no photo yet) it returns a clearly labelled demo suggestion instead,
// so the demo never breaks.
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getUserAndRole } from "@/lib/supabase/server";

const MOCK = {
  title: "Prague Divan Bed",
  description:
    "A sturdy divan bed with a soft fabric finish and a clean, modern look. Choose your size, storage and headboard to suit your room.",
  mock: true,
};

export async function POST(request: Request) {
  // Only logged-in sellers may use it (it costs money).
  const { user, role } = await getUserAndRole();
  if (!user || (role !== "seller" && role !== "admin")) {
    return NextResponse.json({ error: "Please log in as a seller." }, { status: 401 });
  }

  const { imageUrl } = (await request.json().catch(() => ({}))) as { imageUrl?: string | null };

  // Only accept photos that were uploaded to OUR storage bucket.
  const allowedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/`;
  const photoOk = typeof imageUrl === "string" && imageUrl.startsWith(allowedPrefix);

  if (!process.env.ANTHROPIC_API_KEY || !photoOk) {
    return NextResponse.json(MOCK);
  }

  try {
    const client = new Anthropic(); // reads ANTHROPIC_API_KEY
    const response = await client.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: { title: { type: "string" }, description: { type: "string" } },
            required: ["title", "description"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "url", url: imageUrl! } },
            {
              type: "text",
              text: "You write product listings for an online furniture marketplace. Look at this product photo and write a short, honest title (max 70 characters) and a friendly description (2-3 sentences). Only mention what you can see.",
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "The AI could not describe this photo. Please write it yourself." }, { status: 422 });
    }
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") throw new Error("No text in AI response");
    const parsed = JSON.parse(text.text) as { title: string; description: string };
    return NextResponse.json({ title: parsed.title, description: parsed.description, mock: false });
  } catch (e) {
    // Never leak details; log on the server only.
    console.error("AI describe failed:", e instanceof Error ? e.message : e);
    const message = e instanceof Anthropic.RateLimitError ? "The AI is busy. Please try again in a minute." : "The AI request failed. Please try again or write it yourself.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
