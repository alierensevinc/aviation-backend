import { prompt } from "@/app/constants/prompt";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: "gemini-3-flash",
  systemInstruction: prompt,
});

export async function POST(req: Request) {
  try {
    const clientSecret = req.headers.get("x-app-secret");
    if (!clientSecret || clientSecret !== process.env.APP_INTERNAL_SECRET) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
    }

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return NextResponse.json({ answer: text });
  } catch (error) {
    console.error("Hata:", error);
    return NextResponse.json(
      { error: "AI servisi şu an meşgul." },
      { status: 500 },
    );
  }
}
