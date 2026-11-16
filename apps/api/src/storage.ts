import {randomUUID} from 'node:crypto'
import {S3Client,PutObjectCommand,GetObjectCommand} from '@aws-sdk/client-s3'
import {getSignedUrl} from '@aws-sdk/s3-request-presigner'
import {env} from './env.js'
export const s3=new S3Client({region:env.S3_REGION,endpoint:env.S3_ENDPOINT,forcePathStyle:env.S3_FORCE_PATH_STYLE,credentials:{accessKeyId:env.S3_ACCESS_KEY_ID,secretAccessKey:env.S3_SECRET_ACCESS_KEY}})
export async function putObject(key:string,body:Buffer,contentType:string){await s3.send(new PutObjectCommand({Bucket:env.S3_BUCKET,Key:key,Body:body,ContentType:contentType}))}
export async function signedReadUrl(key:string){return getSignedUrl(s3,new GetObjectCommand({Bucket:env.S3_BUCKET,Key:key}),{expiresIn:300})}
export function objectKey(spaceId:string,filename:string){const safe=filename.replace(/[^a-zA-Z0-9._-]/g,'_');return `spaces/${spaceId}/${Date.now()}-${randomUUID()}-${safe}`}
