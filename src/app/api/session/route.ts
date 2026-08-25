import { NextResponse } from "next/server";
import { z } from "zod";
import { getBusinessById } from "@/lib/config/businesses";

const requestSchema = z.object({
  businessId: z.string().min(1),
});

export async function POST(request: Request) {
  const apiKey = process.env.XAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "XAI_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { businessId } = requestSchema.parse(body);

    const business = getBusinessById(businessId);
    if (!business) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    const response = await fetch("https://api.x.ai/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expires_after: { seconds: 300 },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("xAI API error:", response.status, errorText);
      return NextResponse.json(
        { error: "Failed to create session token" },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      token: data.client_secret?.value || data.token,
      expiresAt: data.client_secret?.expires_at || data.expires_at,
      business: {
        id: business.id,
        name: business.name,
        voice: business.voice,
        systemPrompt: business.systemPrompt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Session creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
