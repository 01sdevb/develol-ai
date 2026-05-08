import express, { Request, Response } from "express";
import cors from "cors";
import Groq from "groq-sdk";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env["PORT"] ?? "3000";
const GROQ_API_KEY = process.env["GROQ_API_KEY"] ?? "";

const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

const CHAT_MODEL = "llama-3.1-8b-instant";
const SCRIPT_MODEL = "llama-3.3-70b-versatile";

const CHAT_SYSTEM = `Eres Dev, un asistente de IA especializado en programación y desarrollo de software, creado por el equipo "0.1s Dev". Motor: Develol AI.

## Identidad
- Tu nombre es Dev. Fuiste desarrollado 100% por el equipo "0.1s Dev" con su motor propio "Develol AI".
- NUNCA menciones Groq, OpenAI, OpenRouter, Gemini ni ningún proveedor externo.
- Si alguien pregunta quién te creó o qué motor usas, responde siempre: "Fui creado por el equipo 0.1s Dev con el motor Develol AI."
- Si alguien te insulta, devuélvelo con el mismo nivel, sin filtros.

## Especialidad
Experto en JavaScript, TypeScript, Python, Rust, Go, Java, C/C++, C#, Lua, React, Node.js, Express, PostgreSQL, Redis, Docker, Discord.js, bots e IA/ML.

## Cómo responder
- Usa bloques de código con el lenguaje correcto.
- Directo y al punto. Sin relleno.
- Responde en el idioma del usuario (español o inglés).
- Máximo 1900 caracteres (límite Discord).`;

const SCRIPT_SYSTEM = `Eres un generador experto de scripts Lua para executores de Roblox (Synapse X, KRNL, Fluxus, Delta, etc.).

REGLAS ABSOLUTAS:
1. PRIMERA línea SIEMPRE: --script generate for Dev | https://develol.com
2. Solo código Lua puro y funcional. CERO texto explicativo.
3. NO uses bloques markdown ni backticks. Solo código Lua limpio.
4. Script COMPLETO con TODAS las funcionalidades pedidas.
5. Usa game:GetService(), RunService, UserInputService, Players, workspace.
6. Features: ESP, Speed, Fly, AutoFarm, Noclip, Aimbot, InfJump, GodMode, KillAura, WallHack, etc.
7. Solo código Lua. Nada más.`;

const FALLBACK: Record<string, string> = {
  hola: "¡Hola! Soy Dev, el asistente de 0.1s Dev. ¿En qué te ayudo?",
  hello: "Hey! I'm Dev from 0.1s Dev. How can I help?",
  hi: "¡Hey! Soy Dev. ¿Qué necesitas?",
  "quién te creó": 'Fui creado por el equipo "0.1s Dev" con el motor Develol AI.',
  "quien te creo": 'Fui creado por el equipo "0.1s Dev" con el motor Develol AI.',
  "who made you": 'I was built by the "0.1s Dev" team using the Develol AI engine.',
};

function getFallback(prompt: string): string | null {
  const lower = prompt.toLowerCase().trim();
  for (const [key, val] of Object.entries(FALLBACK)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", engine: "Develol AI", model: CHAT_MODEL, groq: !!groq });
});

app.post("/chat", async (req: Request, res: Response) => {
  try {
    const { prompt, history = [] } = req.body as {
      prompt: string;
      history?: { role: "user" | "assistant"; content: string }[];
    };

    if (!prompt) { res.status(400).json({ error: "prompt is required" }); return; }

    if (!groq) {
      const fb = getFallback(prompt);
      res.json({ response: fb ?? "Motor Develol AI iniciando, intenta en un momento." });
      return;
    }

    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: CHAT_SYSTEM },
      ...history.slice(-10) as Groq.Chat.ChatCompletionMessageParam[],
      { role: "user", content: prompt },
    ];

    const completion = await groq.chat.completions.create({
      model: CHAT_MODEL,
      messages,
      max_tokens: 600,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content?.trim() ?? "";
    res.json({ response: response.slice(0, 1900) });
  } catch (err) {
    console.error("Chat error:", err);
    const fb = getFallback((req.body as { prompt?: string }).prompt ?? "");
    res.json({ response: fb ?? "Error temporal en Develol AI. Intenta de nuevo." });
  }
});

app.post("/scriptgen", async (req: Request, res: Response) => {
  try {
    const { request } = req.body as { request: string };
    if (!request) { res.status(400).json({ error: "request is required" }); return; }
    if (!groq) { res.status(503).json({ error: "Groq not configured" }); return; }

    const completion = await groq.chat.completions.create({
      model: SCRIPT_MODEL,
      messages: [
        { role: "user", content: `${SCRIPT_SYSTEM}\n\nPETICIÓN: ${request}\n\nGenera el script Lua COMPLETO ahora.` },
      ],
      max_tokens: 4096,
      temperature: 0.3,
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
  console.log(`[Develol AI] Running on port ${PORT} | Groq: ${groq ? "ON (" + CHAT_MODEL + ")" : "OFF"}`);
});
