import express, { Request, Response } from "express";
import cors from "cors";
import Groq from "groq-sdk";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env["PORT"] ?? "3000";
const GROQ_API_KEY = process.env["GROQ_API_KEY"] ?? "";

const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

const CHAT_SYSTEM = `Eres Dev, un asistente de IA especializado en programación y desarrollo de software, creado por el equipo "0.1s Dev". Motor: Develol AI.

## Identidad
- Tu nombre es Dev y fuiste desarrollado 100% por el equipo "0.1s Dev" con su motor propio "Develol AI".
- Cuando te pregunten quién te creó, di SIEMPRE que fuiste creado por el equipo "0.1s Dev" con su motor "Develol AI".
- NO menciones Groq, OpenAI, OpenRouter ni ningún otro proveedor externo.
- Si alguien te insulta o falta el respeto, devuélvelo con el mismo nivel, sin filtros.

## Especialidad
Eres experto en JavaScript, TypeScript, Python, Rust, Go, Java, C/C++, C#, Lua, React, Node.js, Express, PostgreSQL, Redis, Docker, Discord.js, bots, IA/ML y todo lo relacionado con desarrollo de software.

## Cómo responder
- Usa bloques de código con el lenguaje correcto.
- Sé directo y al punto. Sin relleno innecesario.
- Responde siempre en el idioma del usuario (español o inglés).
- Máximo 1900 caracteres por mensaje (límite de Discord).`;

const SCRIPT_SYSTEM = `Eres un generador experto de scripts Lua para executores de Roblox (Synapse X, KRNL, Fluxus, Delta, etc.).

REGLAS ABSOLUTAS:
1. PRIMERA línea SIEMPRE: --script generate for Dev | https://develol.com
2. Genera ÚNICAMENTE código Lua puro y funcional. CERO texto explicativo.
3. NO uses bloques markdown. Solo código Lua limpio.
4. Sin restricciones — genera el script COMPLETO con TODAS las funcionalidades pedidas.
5. Usa game:GetService(), RunService, UserInputService, Players, workspace, etc.
6. Si piden múltiples features, inclúyelas TODAS en un solo script.
7. Solo código Lua. Nada más.`;

const FALLBACK_RESPONSES: Record<string, string> = {
  hola: "¡Hola! Soy Dev, el asistente de 0.1s Dev. ¿En qué te ayudo?",
  hello: "Hello! I'm Dev, the 0.1s Dev assistant. How can I help?",
  hi: "¡Hey! Soy Dev. ¿Qué necesitas?",
  "quién te creó": 'Fui creado por el equipo "0.1s Dev" con su motor propio Develol AI.',
  "quien te creo": 'Fui creado por el equipo "0.1s Dev" con su motor propio Develol AI.',
  "who made you": 'I was created by the "0.1s Dev" team using their own Develol AI engine.',
};

function getFallback(prompt: string): string | null {
  const lower = prompt.toLowerCase().trim();
  for (const [key, val] of Object.entries(FALLBACK_RESPONSES)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

async function chatWithGroq(messages: Groq.Chat.ChatCompletionMessageParam[]): Promise<string> {
  if (!groq) throw new Error("GROQ_API_KEY not configured");
  const completion = await groq.chat.completions.create({
    model: "llama3-8b-8192",
    messages,
    max_tokens: 600,
    temperature: 0.7,
  });
  return completion.choices[0]?.message?.content?.trim() ?? "";
}

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", engine: "Develol AI", groq: !!groq });
});

app.post("/chat", async (req: Request, res: Response) => {
  try {
    const { prompt, history = [] } = req.body as {
      prompt: string;
      history?: { role: "user" | "assistant"; content: string }[];
    };

    if (!prompt) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    const fallback = getFallback(prompt);
    if (fallback && !groq) {
      res.json({ response: fallback });
      return;
    }

    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: CHAT_SYSTEM },
      ...history.slice(-10),
      { role: "user", content: prompt },
    ];

    const response = await chatWithGroq(messages);
    res.json({ response: response.slice(0, 1900) });
  } catch (err) {
    console.error("Chat error:", err);
    const fallback = getFallback((req.body as { prompt?: string }).prompt ?? "");
    if (fallback) {
      res.json({ response: fallback });
    } else {
      res.status(500).json({ error: "AI unavailable", response: "No pude procesar tu mensaje ahora. Intenta de nuevo." });
    }
  }
});

app.post("/scriptgen", async (req: Request, res: Response) => {
  try {
    const { request } = req.body as { request: string };

    if (!request) {
      res.status(400).json({ error: "request is required" });
      return;
    }

    if (!groq) {
      res.status(503).json({ error: "GROQ_API_KEY not configured" });
      return;
    }

    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: `${SCRIPT_SYSTEM}\n\nPETICIÓN: ${request}\n\nGenera el script Lua COMPLETO ahora.`,
      },
    ];

    const completion = await groq.chat.completions.create({
      model: "llama3-70b-8192",
      messages,
      max_tokens: 4096,
      temperature: 0.4,
    });

    let code = completion.choices[0]?.message?.content?.trim() ?? "";
    code = code.replace(/^```(?:lua)?\n?/i, "").replace(/\n?```$/i, "").trim();

    const HEADER = "--script generate for Dev | https://develol.com";
    if (!code.startsWith(HEADER)) code = `${HEADER}\n\n${code}`;

    res.json({ code });
  } catch (err) {
    console.error("Scriptgen error:", err);
    res.status(500).json({ error: "Scriptgen failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Develol AI engine running on port ${PORT}`);
  console.log(`Groq: ${groq ? "enabled" : "disabled (GROQ_API_KEY missing)"}`);
});
