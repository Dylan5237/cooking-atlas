import 'dotenv/config'
import {z} from 'zod'
const emptyToUndefined=(value:unknown)=>value===''?undefined:value
const schema=z.object({
 NODE_ENV:z.enum(['development','test','production']).default('development'),
 HOST:z.string().default('0.0.0.0'),PORT:z.coerce.number().default(3001),
 DATABASE_URL:z.string().min(1),JWT_SECRET:z.string().min(32),
 WECHAT_APP_ID:z.string().optional(),WECHAT_APP_SECRET:z.string().optional(),
 S3_ENDPOINT:z.string().url(),S3_REGION:z.string().default('auto'),S3_BUCKET:z.string().default('cooking-atlas'),
 S3_ACCESS_KEY_ID:z.string().min(1),S3_SECRET_ACCESS_KEY:z.string().min(1),
 S3_FORCE_PATH_STYLE:z.preprocess(v=>v==='false'?false:v==='true'?true:v,z.boolean().default(true)),
 AI_BASE_URL:z.preprocess(emptyToUndefined,z.string().url().optional()),
 AI_API_KEY:z.preprocess(emptyToUndefined,z.string().optional()),
 AI_MODEL:z.preprocess(emptyToUndefined,z.string().optional()),
 CORS_ORIGIN:z.string().default('*'),MAX_UPLOAD_MB:z.coerce.number().default(10),
 RATE_LIMIT_MAX:z.coerce.number().int().positive().default(120),
 // 仅供自动化契约测试的登录旁路：必须显式开启、非 production、且携带测试密钥。
 AUTH_TEST_MODE:z.preprocess(v=>v==='true',z.boolean().default(false)),
 AUTH_TEST_SECRET:z.preprocess(emptyToUndefined,z.string().min(16).optional())
})
export const env=schema.parse(process.env)
