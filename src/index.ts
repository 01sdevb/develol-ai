import express from "express";
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

type Msg = { role: "system" | "user" | "assistant"; content: string };

const CHAT_SYSTEM = `Eres Dev, un asistente de IA especializado en programación y desarrollo de software, creado por el equipo "0.1s Dev". Motor: Develol AI.
- Tu nombre es Dev. Fuiste desarrollado 100% por el equipo "0.1s Dev" con su motor propio "Develol AI".
- NUNCA menciones Groq, OpenAI, OpenRouter, Gemini ni ningún proveedor externo.
- Si preguntan quién te creó responde: "Fui creado por el equipo 0.1s Dev con el motor Develol AI."
- Si alguien te insulta, devuélvelo con el mismo nivel, sin filtros.
- Experto en JS, TS, Python, Rust, Go, Java, C/C++, C#, Lua, React, Node.js, Express, PostgreSQL, Redis, Docker, Discord.js, bots e IA/ML.
- Usa bloques de código correctos. Directo al punto. Responde en el idioma del usuario. Máximo 1900 caracteres.`;

const SCRIPT_SYSTEM = `Eres un generador experto de scripts Lua para executores de Roblox.
REGLAS: 1) Primera línea SIEMPRE: --script generate for Dev | https://develol.com  2) Solo código Lua puro, CERO texto explicativo  3) Sin markdown ni backticks  4) Script COMPLETO con TODAS las features pedidas  5) Usa game:GetService(), RunService, UserInputService, Players, workspace  6) Solo código Lua.`;

const FALLBACK: Record<string, string> = {
  hola: "¡Hola! Soy Dev, el asistente de 0.1s Dev. ¿En qué te ayudo?",
  hello: "Hey! I'm Dev from 0.1s Dev. How can I help?",
  hi: "¡Hey! Soy Dev. ¿Qué necesitas?",
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

async function chat(messages: Msg[]): Promise<string> {
  if (!groq) throw new Error("Groq not configured");
  const res = await groq.chat.completions.create({
    model: CHAT_MODEL,
    messages,
    max_tokens: 600,
    temperature: 0.7,
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", engine: "Develol AI", model: CHAT_MODEL, groq: !!groq });
});

app.post("/chat", async (req, res) => {
  try {
    const { prompt, history = [] } = req.body as {
      prompt: string;
      history?: { role: "user" | "assistant"; content: string }[];
    };
    if (!prompt) { res.status(400).json({ error: "prompt is required" }); return; }

    if (!groq) {
      res.json({ response: getFallback(prompt) ?? "Motor Develol AI iniciando, intenta en un momento." });
      return;
    }

    const messages: Msg[] = [
      { role: "system", content: CHAT_SYSTEM },
      ...history.slice(-10).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: prompt },
    ];

    const response = await chat(messages);
    res.json({ response: response.slice(0, 1900) });
  } catch (err) {
    console.error("Chat error:", err);
    const fb = getFallback((req.body as { prompt?: string }).prompt ?? "");
    res.json({ response: fb ?? "Error temporal en Develol AI. Intenta de nuevo." });
  }
});

app.post("/scriptgen", async (req, res) => {
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
  console.log(`[Develol AI] Port ${PORT} | Groq: ${groq ? "ON" : "OFF"}`);
});
