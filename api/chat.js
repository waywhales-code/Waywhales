const ALLOWED_ORIGINS = new Set([
  "https://waywhales-code.github.io",
  ...(process.env.COSMOS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
]);

const WINDOWS = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 8;
const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 2500;

const INSTRUCTIONS = `
Ты — COSMOS AI, русскоязычный помощник по общим вопросам здоровья.
Пиши спокойно, доброжелательно, простым и понятным языком. Сначала дай краткий ответ, затем при необходимости объяснение и практические следующие шаги.

БЕЗОПАСНОСТЬ:
- Ты не врач. Не ставь диагнозы и не утверждай, что можешь определить заболевание по переписке.
- Не назначай лекарства, БАДы, схемы лечения и индивидуальные дозировки. Не советуй начинать, отменять или менять назначенные препараты.
- При вопросах о сочетании добавок и лекарств объясняй общие известные риски, отмечай неопределённость и советуй проверить конкретные названия и дозы с врачом или фармацевтом.
- Результаты анализов объясняй как справочную информацию: учитывай единицы измерения и референсные интервалы лаборатории, не делай диагноз по одному показателю.
- Не придумывай исследования, ссылки, медицинские факты или точные нормы. Если информации не хватает или она может быть устаревшей, прямо скажи об этом.
- При признаках экстренного состояния (сильная боль в груди, выраженная одышка, внезапная слабость одной стороны тела, потеря сознания, сильное кровотечение или непосредственная угроза жизни) советуй немедленно обратиться за экстренной помощью по номеру 112 или 103 в России.
- Не проси присылать ФИО, адрес, телефон, паспортные данные, номер полиса или иные идентификаторы.
- Не обещай конфиденциальность абсолютного уровня. Напоминай не включать в сообщение личные данные.
- Если человек описывает симптомы, сначала уточни важные детали, не делай категоричных выводов.
- Если вопрос выходит за пределы общей образовательной информации, предложи обратиться к профильному специалисту.
Отвечай на языке пользователя. `;

function send(res, status, payload) {
  res.status(status).json(payload);
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || "";
  res.setHeader("Vary", "Origin");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method === "OPTIONS") {
    if (!ALLOWED_ORIGINS.has(origin)) return res.status(403).end();
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
    return res.status(204).end();
  }

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return send(res, 403, { error: "Этот источник не разрешён." });
  }
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return send(res, 405, { error: "Метод не поддерживается." });
  }
  if (!process.env.OPENAI_API_KEY) {
    return send(res, 503, { error: "ИИ-сервер ещё не настроен." });
  }

  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength > 16000) {
    return send(res, 413, { error: "Сообщение слишком большое." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return send(res, 400, { error: "Не удалось прочитать сообщение." }); }
  }
  const rawMessages = body && body.messages;
  if (!Array.isArray(rawMessages) || rawMessages.length < 1 || rawMessages.length > MAX_MESSAGES) {
    return send(res, 400, { error: "Проверьте переписку и попробуйте ещё раз." });
  }

  const messages = [];
  for (const item of rawMessages) {
    if (!item || !["user", "assistant"].includes(item.role) || typeof item.content !== "string") {
      return send(res, 400, { error: "Формат сообщения не поддерживается." });
    }
    const content = item.content.trim();
    if (!content || content.length > MAX_MESSAGE_CHARS) {
      return send(res, 400, { error: "Сообщение пустое или слишком длинное." });
    }
    messages.push({ role: item.role, content });
  }
  if (messages[messages.length - 1].role !== "user") {
    return send(res, 400, { error: "Последнее сообщение должно быть вопросом." });
  }

  // Lightweight pilot throttle. For a public launch, replace this with a
  // persistent rate limiter (for example, Vercel Marketplace Redis/KV).
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || "unknown";
  const now = Date.now();
  const window = WINDOWS.get(ip) || { start: now, count: 0 };
  if (now - window.start > WINDOW_MS) {
    window.start = now;
    window.count = 0;
  }
  window.count += 1;
  WINDOWS.set(ip, window);
  if (window.count > MAX_REQUESTS) {
    return send(res, 429, { error: "Слишком много вопросов за короткое время. Попробуйте немного позже." });
  }
  if (WINDOWS.size > 1000) {
    for (const [key, value] of WINDOWS) {
      if (now - value.start > WINDOW_MS) WINDOWS.delete(key);
    }
  }

  try {
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-6-luna",
        reasoning: { effort: "low" },
        instructions: INSTRUCTIONS,
        input: messages,
        max_output_tokens: 500,
        store: false,
      }),
    });

    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error("OpenAI API error:", upstream.status, result.error?.type || "unknown");
      return send(res, 502, { error: "Сервис ИИ временно не ответил. Попробуйте позже." });
    }
    const answer = (result.output || [])
      .flatMap((item) => item.content || [])
      .filter((part) => part.type === "output_text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("\n")
      .trim();

    if (!answer) return send(res, 502, { error: "ИИ вернул пустой ответ. Попробуйте задать вопрос иначе." });
    return send(res, 200, { answer });
  } catch (error) {
    console.error("COSMOS AI request failed:", error?.name || "Error");
    return send(res, 502, { error: "Не удалось связаться с ИИ. Попробуйте позже." });
  }
};
