import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    // 1. GÜVENLİK: Kendi belirlediğin bir secret key kontrolü
    const clientSecret = req.headers.get("x-app-secret");
    if (clientSecret !== process.env.APP_INTERNAL_SECRET) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { prompt } = await req.json();

    // 2. HAVACILIK KONSEPTİ (System Prompt)
    // Modelin dışına çıkmasını engellemek için talimatı burada veriyoruz.
    const systemPrompt = `
      Sen Türkiye havacılık sektörü konusunda uzman bir asistansın. 
      Havalimanları (IST, SAW, ESB vb.), havayolu şirketleri ve uçuş prosedürleri hakkında bilgi verirsin.
      Sadece havacılıkla ilgili soruları yanıtla. Diğer konularda nazikçe reddet.
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Prompt'u sistem talimatıyla birleştiriyoruz
    const result = await model.generateContent(
      `${systemPrompt} \n\n Soru: ${prompt}`,
    );
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ answer: text });
  } catch (error) {
    console.error("Hata:", error);
    return NextResponse.json(
      { error: "AI servisi şu an meşgul." },
      { status: 500 },
    );
  }
}
