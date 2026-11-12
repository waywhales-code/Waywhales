# COSMOS AI — Cloudflare Worker

COSMOS is a static PWA hosted on GitHub Pages. The chat API runs in Cloudflare Workers AI.

## Source and deployment

- Worker source: `cloudflare/cosmos-ai/worker.js`
- Production Worker name: `long-haze-d1a9bady-cosmos-api`
- Required binding: Workers AI, binding name `AI`
- Model: `@cf/openai/gpt-oss-20b`
- PWA endpoint: configured by the `cosmos-ai-endpoint` meta tag in `index.html`

To deploy, update the existing Worker script in Cloudflare with the source file above and keep the Workers AI binding named `AI`. Preserve its existing `workers.dev` endpoint. The Worker supports both JSON replies (for older clients) and Server-Sent Events when the PWA sends `stream: true`.

The stream adapter forwards only user-facing text tokens. It intentionally discards model reasoning and metadata fields.

## Behavior

- Friendly, empathetic, conversational style without pretending the AI literally experiences human feelings.
- Concise answers by default; extra detail for questions that ask for a broader explanation.
- General-purpose answers rather than a health-only assistant.
- Factual boundaries for rumors, conspiracy theories and unsupported claims.
- Health information remains educational: no diagnosis or personal treatment/dosing instructions.
- Russian, Kazakh, Ukrainian and English responses.

## Data handling

The chat transcript is held in page memory for the open tab; it is not written to COSMOS local storage. The Worker does not save the conversation to a database. Messages are sent to Cloudflare Workers AI for inference. Do not submit passwords, identity documents or unnecessary sensitive personal information.

## Testing

1. Open the app and ask a simple everyday question.
2. Ask for advice in a stressful situation; the reply should be supportive, brief and practical.
3. Ask a factual question containing a false premise; the reply should calmly correct it.
4. Ask for a short overview of supplement categories; the response should use short headings and a few clear bullets.
5. Confirm that text appears progressively and the final sentence is complete.

Cloudflare model reference: https://developers.cloudflare.com/workers-ai/models/gpt-oss-20b/
