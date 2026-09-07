/**
 * Sets the R2 bucket CORS rule that lets the browser PUT pictures straight to storage
 * (signed upload tickets — see src/lib/uploads/direct.ts). Re-run when a new origin
 * (domain) is added. Env: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
 *
 *   node scripts/r2-cors.mjs
 */
import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";
const env = process.env;
const s3 = new S3Client({ region: "auto", endpoint: env.R2_ENDPOINT, credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY }, forcePathStyle: true });
await s3.send(new PutBucketCorsCommand({ Bucket: env.R2_BUCKET, CORSConfiguration: { CORSRules: [{
  AllowedOrigins: ["https://eajc.sundaytomonday.church", "https://church-panels-staging.vercel.app", "http://localhost:3000"],
  AllowedMethods: ["PUT", "GET", "HEAD"],
  AllowedHeaders: ["*"],
  ExposeHeaders: ["ETag"],
  MaxAgeSeconds: 3600,
}] } }));
const res = await s3.send(new GetBucketCorsCommand({ Bucket: env.R2_BUCKET }));
console.log(JSON.stringify(res.CORSRules));
