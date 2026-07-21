# Bento ChatGPT Proxy Server

Express proxy that enables "Sign in with ChatGPT" — OAuth device flow with an OpenAI-compatible `/api/v1/chat/completions` endpoint.

## Deploy to Render

### One-click

1. Push this directory to a Git repo (or fork the Bento monorepo)
2. In Render Dashboard → New → Web Service
3. Connect your repo and select the `apps/server` directory
4. Render auto-detects `render.yaml`, or manually set:
   - **Build Command**: `npm install --production`
   - **Start Command**: `node src/index.js`
5. Add environment variables (see below)
6. Deploy

### Environment Variables

| Variable          | Required | Description                                                                               |
| ----------------- | -------- | ----------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`  | Yes      | Your OpenAI API key (`sk-...`)                                                            |
| `JWT_SECRET`      | Yes      | Random hex string for signing JWTs (`openssl rand -hex 32`)                               |
| `PORT`            | No       | Port (default `3001`)                                                                     |
| `ALLOWED_ORIGINS` | No       | Comma-separated CORS origins (default `http://localhost:1420,tauri://localhost,bento://`) |
| `OPENAI_MODEL`    | No       | Default model (default `gpt-4o`)                                                          |
| `MAX_TOKENS`      | No       | Max tokens per response (default `4096`)                                                  |

### Verify Deployment

```
curl https://your-service.onrender.com/api/health
# → { "status": "ok", "version": "1.0.0", ... }
```

Then use the deployment URL in the Bento desktop app's ChatGPT auth settings (e.g. `https://your-service.onrender.com`).

## Deploy to Vercel

1. Push to a Git repo
2. Import project in Vercel — set root directory to `apps/server`
3. Add environment variables in Vercel dashboard
4. Deploy

## Local Development

```bash
cp .env.example .env
# Edit .env with your OPENAI_API_KEY and JWT_SECRET
npm install
npm run dev
```
