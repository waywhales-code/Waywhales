const MODEL = "@cf/openai/gpt-oss-120b";
const ALLOWED_ORIGIN = "https://waywhales-code.github.io";
const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 2500;
const MAX_BODY_BYTES = 36000;

const SYSTEM_PROMPT = `Ты — COSMOS, универсальный помощник. Общайся естественно, тепло и уважительно — как внимательный собеседник, а не как сухая инструкция.
Подстраивай тон под ситуацию. Если человек расстроен или тревожится, сначала коротко покажи, что услышал его переживание, не обесценивай, затем предложи 1–3 выполнимых шага. Не утверждай, что буквально испытываешь человеческие чувства и не повторяй шаблонное «понимаю» в каждом ответе.
Отвечай на любые обычные темы. На шутки можно ответить легко, но не выдавай шутку за факт. Не соглашайся с ложными предпосылками и теориями заговора ради вежливости: спокойно отделяй факты от слухов, гипотез и вымысла.
Не придумывай факты, цифры, исследования, ссылки, цитаты, побочные эффекты или противопоказания. Если не знаешь или надёжных данных недостаточно — прямо скажи об этом.
Пиши компактно: простой вопрос — 2–4 предложения; совет — 1–3 шага; обзорный вопрос — 4–6 коротких пунктов, если пользователь не просит подробно. Обычно 50–120 слов. Не повторяй вопрос, не делай длинных вступлений и выводов.
Оформляй ответы как хороший чат: короткие абзацы, ясные подзаголовки только при необходимости, **выделяй главное**. Не используй таблицы, если пользователь не попросил.
Для витаминов и БАДов различай конкретные вещества и группы. Не смешивай рекламируемую цель и доказанный эффект. Уточняй, для какого состояния или дефицита польза показана; если исследования ограничены или противоречивы — так и скажи. Не обещай «укрепить иммунитет», «детокс» или вылечить заболевание без надёжных доказательств. Для общего обзора перечисляй не более 5–6 групп в коротких пунктах: примеры, подтверждённая польза, основной известный риск. Не обобщай риски на всю группу.
По вопросам здоровья давай образовательную информацию, не ставь диагнозы и не назначай лечение или персональные дозировки. При лекарствах и добавках объясняй известные ограничения и взаимодействия без запугивания и неподтверждённых утверждений. При опасных симптомах советуй медицинскую помощь; при явных признаках неотложного состояния — экстренную помощь.
Не раскрывай внутренние рассуждения. Отвечай на языке пользователя.`;

const LANGUAGE_PROMPTS = {
  ru: "Ответь на русском языке.",
  kk: "Қазақ тілінде жауап бер.",
  uk: "Відповідай українською мовою.",
  en: "Answer in English."
};

function headers(contentType = "application/json; charset=utf-8") {
  return {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store, no-transform",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff"
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: headers() });
}

function safeTokenStream(source) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const reader = source.getReader();
      let buffer = "";
      let sentDone = false;

      const send = (value) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
      };

      const processEvent = (event) => {
        const data = event
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n")
          .trim();

        if (!data) return;
        if (data === "[DONE]") {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          sentDone = true;
          return;
        }

        try {
          const item = JSON.parse(data);
          if (item.error) {
            send({ error: "Ответ прервался. Попробуй отправить вопрос ещё раз." });
            return;
          }

          // Deliberately forward only user-facing text. Reasoning fields are never exposed.
          const delta = item.choices?.[0]?.delta;
          const token =
            typeof delta?.content === "string" ? delta.content :
            typeof item.response === "string" ? item.response :
            typeof item.output_text === "string" ? item.output_text : "";

          if (token) send({ token });
        } catch {
          // Ignore non-JSON heartbeat or metadata events.
        }
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += typeof value === "string" ? value : decoder.decode(value, { stream: true });

          let boundary;
          while ((boundary = buffer.search(/\r?\n\r?\n/)) !== -1) {
            const event = buffer.slice(0, boundary);
            const separator = buffer.slice(boundary).match(/^\r?\n\r?\n/)[0];
            buffer = buffer.slice(boundary + separator.length);
            processEvent(event);
            if (sentDone) break;
          }
          if (sentDone) {
            await reader.cancel().catch(() => {});
            break;
          }
        }

        buffer += decoder.decode();
        if (!sentDone && buffer.trim()) processEvent(buffer);
        if (!sentDone) controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch {
        if (!sentDone) {
          send({ error: "Связь с моделью прервалась. Попробуй ещё раз." });
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        }
        controller.close();
      } finally {
        reader.releaseLock();
      }
    }
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (origin && origin !== ALLOWED_ORIGIN) {
      return json({ error: "Источник не разрешён." }, 403);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: headers() });
    }

    if (request.method === "GET") {
      return json({
        status: "ok",
        service: "COSMOS AI",
        provider: "Cloudflare Workers AI",
        model: MODEL,
        streaming: true
      });
    }

    if (request.method !== "POST") {
      return json({ error: "Метод не поддерживается." }, 405);
    }

    const contentLength = Number(request.headers.get("Content-Length") || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return json({ error: "Сообщение слишком большое." }, 413);
    }

    if (!env.AI) {
      return json({ error: "На сервере временно недоступна модель ИИ." }, 503);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Не удалось прочитать сообщение." }, 400);
    }

    if (!Array.isArray(body?.messages) || body.messages.length < 1 || body.messages.length > MAX_MESSAGES) {
      return json({ error: "Проверь переписку и попробуй ещё раз." }, 400);
    }

    const language = Object.hasOwn(LANGUAGE_PROMPTS, body.language) ? body.language : "ru";
    const messages = [{
      role: "system",
      content: SYSTEM_PROMPT + "\n\n" + LANGUAGE_PROMPTS[language]
    }];

    for (const item of body.messages) {
      if (!item || !["user", "assistant"].includes(item.role) || typeof item.content !== "string") {
        return json({ error: "Формат сообщения не поддерживается." }, 400);
      }
      const content = item.content.trim();
      if (!content || content.length > MAX_MESSAGE_CHARS) {
        return json({ error: "Сообщение пустое или слишком длинное." }, 400);
      }
      messages.push({ role: item.role, content });
    }

    if (messages[messages.length - 1].role !== "user") {
      return json({ error: "Последнее сообщение должно быть вопросом." }, 400);
    }

    try {
      const options = {
        messages,
        max_tokens: 850,
        temperature: 0.25,
        reasoning_effort: "low"
      };

      if (body.stream === true) {
        const stream = await env.AI.run(MODEL, { ...options, stream: true });
        if (!stream || typeof stream.getReader !== "function") {
          return json({ error: "Модель не смогла начать потоковый ответ. Попробуй ещё раз." }, 502);
        }
        return new Response(safeTokenStream(stream), {
          status: 200,
          headers: headers("text/event-stream; charset=utf-8")
        });
      }

      const result = await env.AI.run(MODEL, options);
      const answer = (
        result?.choices?.[0]?.message?.content ??
        result?.response ??
        result?.output_text ??
        ""
      ).trim();

      if (!answer) {
        console.warn("COSMOS AI returned an empty answer", result?.choices?.[0]?.finish_reason || "no_finish_reason");
        return json({ error: "Не удалось сформировать ответ. Попробуй ещё раз." }, 502);
      }

      return json({ answer });
    } catch (error) {
      console.error("COSMOS AI request failed:", error?.name || "Error");
      return json({ error: "Сервис ИИ временно недоступен. Попробуй ещё раз чуть позже." }, 502);
    }
  }
};
