import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  // Check if a token and mode is in the query string of the request
  if (mode && token) {
    // Check the mode and token sent is correct
    if (
      mode === "subscribe" &&
      token === (process.env.META_WEBHOOK_VERIFY_TOKEN || "ea360-webhook-secret")
    ) {
      return new NextResponse(challenge, { status: 200 });
    }
    return new NextResponse("Forbidden", { status: 403 });
  }
  return new NextResponse("Bad Request", { status: 400 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Log message status for MVP
    console.log("Received Meta Webhook:", JSON.stringify(body, null, 2));

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
