import { NextResponse } from "next/server";
import { generateN8nWorkflow } from "@/lib/executor/n8n-export";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const funnelId = searchParams.get("funnelId");

  if (!funnelId) {
    return NextResponse.json({ error: "Missing funnelId" }, { status: 400 });
  }

  try {
    const { workflow, filename } = await generateN8nWorkflow(funnelId);

    return new NextResponse(JSON.stringify(workflow, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
