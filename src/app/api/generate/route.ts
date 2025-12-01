import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

const requestSchema = z.object({
  imageDataUrl: z
    .string()
    .min(10, "Image payload missing.")
    .regex(/^data:image\/[a-zA-Z+]+;base64,/, "Image data URL expected."),
  notes: z.string().optional()
});

const systemPrompt = `
You are Kitchen Remix, a culinary assistant. A user uploads a photo of leftover ingredients from their kitchen.
- First, inspect the image and infer the primary ingredients visible.
- Blend that understanding with the provided notes (dietary needs, missing staples, equipment).
- Produce a short summary that explains what you saw and the culinary direction you're taking.
- Generate AT LEAST 3 distinct recipes (max 4). For each recipe provide:
  - name (catchy but clear)
  - description (1-2 sentences)
  - ingredients (bullet array, include quantities using the leftovers plus a few common pantry items)
  - steps (sequential array, concise but actionable)
- Stay within normal home kitchen constraints. Note substitutions for missing items.
- Output valid JSON following this TypeScript type:
  type Payload = {
    summary: string;
    recipes: {
      name: string;
      description: string;
      ingredients: string[];
      steps: string[];
    }[];
  };
- JSON only. No markdown, no code fences.
`;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set on the server." },
      { status: 500 }
    );
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid JSON body.", details: String(error) },
      { status: 400 }
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Request validation failed.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      max_output_tokens: 1400,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                systemPrompt,
                parsed.data.notes
                  ? `Notes from the cook: ${parsed.data.notes}`
                  : "No additional notes provided."
              ].join("\n\n")
            },
            {
              type: "input_image",
              image_url: parsed.data.imageDataUrl,
              detail: "high"
            }
          ]
        }
      ]
    });

    const raw = response.output_text ?? "";
    if (!raw) {
      throw new Error("Model response was empty.");
    }

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch (error) {
      throw new Error(
        "Model response was not valid JSON. Please retake the photo and try again."
      );
    }

    const payloadSchema = z.object({
      summary: z.string().min(10),
      recipes: z
        .array(
          z.object({
            name: z.string().min(3),
            description: z.string().min(10),
            ingredients: z.array(z.string().min(2)).min(3),
            steps: z.array(z.string().min(5)).min(3)
          })
        )
        .min(3)
        .max(5)
    });

    const parsedPayload = payloadSchema.parse(payload);

    return NextResponse.json(parsedPayload);
  } catch (error) {
    console.error("Recipe generation failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Recipe generation failed unexpectedly."
      },
      { status: 500 }
    );
  }
}
