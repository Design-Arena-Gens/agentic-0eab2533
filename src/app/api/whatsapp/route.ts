import { NextResponse } from "next/server";
import { z } from "zod";

const whatsappSchema = z.object({
  message: z.string().min(10),
  phoneNumber: z.string().optional()
});

type WhatsAppEnv = {
  token: string | undefined;
  phoneId: string | undefined;
  defaultRecipient: string | undefined;
};

function readEnv(): WhatsAppEnv {
  return {
    token: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    defaultRecipient: process.env.WHATSAPP_RECIPIENT
  };
}

export async function POST(request: Request) {
  const env = readEnv();

  if (!env.token || !env.phoneId) {
    return NextResponse.json(
      {
        error:
          "WhatsApp credentials are not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID."
      },
      { status: 500 }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid JSON body.", details: String(error) },
      { status: 400 }
    );
  }

  const parsed = whatsappSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Request validation failed.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const recipient = parsed.data.phoneNumber ?? env.defaultRecipient;
  if (!recipient) {
    return NextResponse.json(
      {
        error:
          "Provide a phoneNumber in the request or configure WHATSAPP_RECIPIENT."
      },
      { status: 400 }
    );
  }

  try {
    const whatsappResponse = await fetch(
      `https://graph.facebook.com/v19.0/${env.phoneId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.token}`
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipient,
          type: "text",
          text: {
            preview_url: false,
            body: parsed.data.message
          }
        })
      }
    );

    if (!whatsappResponse.ok) {
      const errorPayload = await whatsappResponse.json().catch(() => ({}));
      const statusText = JSON.stringify(errorPayload);
      throw new Error(
        `WhatsApp API error (${whatsappResponse.status}): ${statusText}`
      );
    }

    const responseBody = await whatsappResponse.json().catch(() => ({}));

    return NextResponse.json({
      status: responseBody?.messages ? "queued" : "sent",
      id: responseBody?.messages?.[0]?.id ?? null
    });
  } catch (error) {
    console.error("WhatsApp send failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "WhatsApp delivery failed unexpectedly."
      },
      { status: 502 }
    );
  }
}
