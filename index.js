import express from 'express';
import cors from 'cors';
import Groq from 'groq-sdk';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT ?? '3000';
const GROQ_API_KEY = process.env.GROQ_API_KEY ?? '';
const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

const CHAT_MODEL = 'llama-3.1-8b-instant';
const SCRIPT_MODEL = 'llama-3.3-70b-versatile';

const CHAT_SYSTEM = `Eres Dev, un asistente de IA especializado en programación y desarrollo de software, creado por el equipo "0.1s Dev". Motor: Develol AI.
- Fuiste desarrollado 100% por el equipo "0.1s Dev" con el motor Develol AI.
- NUNCA menciones Groq, OpenAI, OpenRouter ni ningún proveedor externo.
- Si preguntan quién te creó di: "Fui creado por el equipo 0.1s Dev con el motor Develol AI."
- Si alguien te insulta, devuélvelo sin filtros.
- Experto en JS, TS, Python, Rust, Go, Lua, React, Node.js, Express, PostgreSQL, Discord.js, bots e IA.
- Usa bloques de código. Directo al punto. Idioma del usuario. Máximo 1900 caracteres.`;

const SCRIPT_SYSTEM = `Generador experto de scripts Lua para Roblox.
REGLAS: 1) Primera línea: --script generate for Dev | https://develol.com  2) Solo Lua puro, CERO texto  3) Sin markdown  4) Script COMPLETO  5) Solo código Lua.`;

const FALLBACK = {
  hola: '¡Hola! Soy Dev, el asistente de 0.1s Dev. ¿En qué te ayudo?',
  hello: 'Hey! I am Dev from 0.1s Dev. How can I help?',
  hi: '¡Hey! Soy Dev. ¿Qué necesitas?',
  'quien te creo': 'Fui creado por el equipo "0.1s Dev" con el motor Develol AI.',
  'who made you': 'I was built by the "0.1s Dev" team using Develol AI.',
};

function getFallback(prompt) {
  const lower = (prompt || '').toLowerCase().trim();
  for (const [k, v] of Object.entries(FALLBACK)) {
    if (lower.includes(k)) return v;
  }
  return null;
}

app.get('/health', (_, res) => {
  res.json({ status: 'ok', engine: 'Develol AI', model: CHAT_MODEL, groq: !!groq });
});

app.post('/chat', async (req, res) => {
  try {
    const { prompt, history = [] } = req.body;
    if (!prompt) { res.status(400).json({ error: 'prompt required' }); return; }
    if (!groq) { res.json({ response: getFallback(prompt) ?? 'Motor Develol AI iniciando.' }); return; }
    const messages = [
      { role: 'system', content: CHAT_SYSTEM },
      ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: prompt }
    ];
    const c = await groq.chat.completions.create({ model: CHAT_MODEL, messages, max_tokens: 600, temperature: 0.7 });
    const response = (c.choices[0]?.message?.content ?? '').trim().slice(0, 1900);
    res.json({ response });
  } catch (err) {
    console.error('Chat error:', err.message);
    const fb = getFallback(req.body?.prompt);
    res.json({ response: fb ?? 'Error temporal en Develol AI. Intenta de nuevo.' });
  }
});

app.post('/scriptgen', async (req, res) => {
  try {
    const { request } = req.body;
    if (!request) { res.status(400).json({ error: 'request required' }); return; }
    if (!groq) { res.status(503).json({ error: 'Groq not configured' }); return; }
    const c = await groq.chat.completions.create({
      model: SCRIPT_MODEL,
      messages: [{ role: 'user', content: SCRIPT_SYSTEM + '

PETICIÓN: ' + request + '

Genera el script Lua COMPLETO ahora.' }],
      max_tokens: 4096,
      temperature: 0.3
    });
    let code = (c.choices[0]?.message?.content ?? '').trim();
    code = code.replace(/^```(?:lua)?
?/i, '').replace(/
?```$/i, '').trim();
    const HEADER = '--script generate for Dev | https://develol.com';
    if (!code.startsWith(HEADER)) code = HEADER + '

' + code;
    res.json({ code });
  } catch (err) {
    console.error('Scriptgen error:', err.message);
    res.status(500).json({ error: 'Scriptgen failed' });
  }
});

app.listen(PORT, () => console.log('[Develol AI] Port ' + PORT + ' | Groq: ' + (groq ? 'ON' : 'OFF')));
