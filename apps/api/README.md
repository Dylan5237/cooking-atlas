# Cooking Atlas API

Fastify + Prisma + PostgreSQL + S3-compatible object storage.

## Local development

1. Start infrastructure from repository root: `docker compose up -d`.
2. Create a bucket named `cooking-atlas` in MinIO Console: http://localhost:9001 (user/password: cooking / cooking_dev_only).
3. Copy `apps/api/.env.example` to `apps/api/.env`; fill WeChat and AI credentials when needed.
4. From repository root run `npm install`.
5. Run migrations: `npm --workspace @cooking-atlas/api run db:dev -- --name init`.
6. Start API: `npm run dev:api`.

Health check: http://localhost:3001/health

## Storage

The API uses S3 protocol via AWS SDK. Local MinIO is for development only. Production may use Tencent COS, Cloudflare R2, AWS S3 or another S3-compatible provider. Keep buckets private; API creates short-lived signed read URLs for AI image analysis. Never expose storage credentials to the mini program.

## WeChat login

Configure WECHAT_APP_ID and WECHAT_APP_SECRET on the server. The mini program exchanges wx.login code at POST /api/auth/wechat. The AppSecret never goes to the client.

## Production

Use a managed PostgreSQL service or self-hosted PostgreSQL with automated backups, TLS and restricted network access. Deploy API behind HTTPS; configure WeChat request/uploadFile legal domains. Set a strong JWT_SECRET and production object storage credentials. Run Prisma migrations as a release step.
