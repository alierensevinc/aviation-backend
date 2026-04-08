import { prompt as systemInstructionPrompt } from "@/app/constants/prompt";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-lite",
  systemInstruction: systemInstructionPrompt,
});

let ratelimit: Ratelimit | undefined;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, "1 m"),
  });
}

const chatRequestSchema = z.object({
  message: z.string().min(1, "Mesaj boş olamaz"),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        parts: z.array(z.object({ text: z.string() })),
      }),
    )
    .optional()
    .default([]),
});

export async function POST(req: Request) {
  try {
    if (ratelimit) {
      const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
      const { success, limit, remaining, reset } = await ratelimit.limit(ip);
      
      if (!success) {
        return NextResponse.json(
          { error: "Dakikadaki istek limitinizi aştınız. Lütfen biraz bekleyip tekrar deneyin." },
          { 
            status: 429,
            headers: {
              "X-RateLimit-Limit": limit.toString(),
              "X-RateLimit-Remaining": remaining.toString(),
              "X-RateLimit-Reset": reset.toString()
            }
          }
        );
      }
    }

    const clientSecret = req.headers.get("x-app-secret");
    if (!clientSecret || clientSecret !== process.env.APP_INTERNAL_SECRET) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    let unparsedBody;
    try {
      unparsedBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Geçersiz JSON formatı" },
        { status: 400 },
      );
    }

    const parsed = chatRequestSchema.safeParse(unparsedBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Geçersiz istek formatı", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { message, history } = parsed.data;

    let limitedHistory = history.slice(-5);
    if (limitedHistory.length > 0 && limitedHistory[0].role === "model") {
      limitedHistory = limitedHistory.slice(1);
    }

    const chat = model.startChat({
      history: limitedHistory,
      generationConfig: {
        maxOutputTokens: 1000,
      },
    });

    const result = await chat.sendMessageStream(message);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            controller.enqueue(encoder.encode(chunkText));
          }
        } catch (streamError) {
          console.error("Stream parsing error:", streamError);
          controller.error(streamError);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        Connection: "keep-alive",
        "Transfer-Encoding": "chunked",
        "x-context-count": limitedHistory.length.toString(),
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS,PATCH,DELETE,POST,PUT",
        "Access-Control-Allow-Headers": "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-app-secret",
      },
    });
  } catch (unknownError) {
    const error = unknownError as { status?: number; message?: string };
    console.error("Hata:", error);

    let statusCode = 500;
    let errorMessage =
      "AI servisi şu an meşgul veya beklenmeyen bir hata oluştu.";

    if (
      error?.status === 429 ||
      error?.message?.toLowerCase().includes("quota")
    ) {
      statusCode = 429;
      errorMessage = "Gemini API kullanım limiti (kota) aşıldı.";
    } else if (
      error?.status === 400 ||
      error?.message?.toLowerCase().includes("invalid")
    ) {
      statusCode = 400;
      errorMessage = "AI servisine geçersiz bir parametre gönderildi.";
    } else if (error?.message?.toLowerCase().includes("safety")) {
      statusCode = 403;
      errorMessage =
        "Gönderilen istek veya alınacak yanıt güvenlik kurallarına takıldı.";
    }

    return NextResponse.json(
      { error: errorMessage, details: error?.message || "" },
      { status: statusCode },
    );
  }
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS,PATCH,DELETE,POST,PUT",
      "Access-Control-Allow-Headers": "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-app-secret",
    },
  });
}
