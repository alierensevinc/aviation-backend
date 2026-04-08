import { prompt as systemInstructionPrompt } from "@/app/constants/prompt";
import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-lite",
  systemInstruction: systemInstructionPrompt,
});

interface ChatRequest {
  message: string;
  history?: Content[];
}

export async function POST(req: Request) {
  try {
    const clientSecret = req.headers.get("x-app-secret");
    if (!clientSecret || clientSecret !== process.env.APP_INTERNAL_SECRET) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const body = (await req.json()) as Partial<ChatRequest>;
    const { history, message } = body;

    if (!message || typeof message !== "string" || message.trim() === "") {
      return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
    }

    const limitedHistory: Content[] =
      history && Array.isArray(history) ? history.slice(-5) : [];

    const chat = model.startChat({
      history: limitedHistory,
      generationConfig: {
        maxOutputTokens: 1000,
      },
    });

    const result = await chat.sendMessage(message);
    const text = result.response.text();

    return NextResponse.json({
      answer: text,
      contextCount: limitedHistory.length,
    });
  } catch (error) {
    console.error("Hata:", error);
    return NextResponse.json(
      { error: "AI servisi şu an meşgul." },
      { status: 500 },
    );
  }
}
