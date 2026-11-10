# COSMOS AI — server setup

The PWA stays on GitHub Pages. The API route in `api/chat.js` is a Vercel Node.js Function.

## Deploy

1. In Vercel, import the GitHub repository `waywhales-code/Waywhales`.
2. Keep the project root at the repository root. No build command or output directory is required for this static HTML + API layout.
3. In Project → Settings → Environment Variables, add:
   - `OPENAI_API_KEY` — create a project API key in the OpenAI Platform. Add it as a **Secret** in Vercel. Never put it in this repository or in the PWA.
   - Optional: `COSMOS_ALLOWED_ORIGINS` — comma-separated browser origins, for example `https://waywhales-code.github.io`.
4. Redeploy the Vercel project after adding the secret.
5. Copy the deployment URL, then set the `cosmos-ai-endpoint` meta tag in `index.html` to `https://YOUR-VERCEL-DOMAIN/api/chat`.

## Test before public launch

- Send one short question from the COSMOS home screen.
- Check that the answer appears and that no API key is present in browser source or network responses.
- Set a small monthly usage budget / alert on the OpenAI API project.
- The in-memory IP throttle in this pilot is best-effort only and may reset or be split across serverless instances. Before inviting the public, add persistent rate limiting and an abuse-control step (such as an accessible challenge or sign-in).

## Data handling

- The chat transcript stays in page memory only; it is not written to COSMOS localStorage.
- Requests use the OpenAI Responses API with `store: false`.
- The API key is read only from the Vercel server environment.
- Users are warned not to submit identifiers or unnecessary sensitive health details.
- COSMOS AI provides general educational information, not diagnosis or treatment.
