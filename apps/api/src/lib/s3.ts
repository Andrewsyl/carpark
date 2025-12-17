import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const { AWS_REGION, S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = process.env;

if (!AWS_REGION || !S3_BUCKET_NAME || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  console.warn(
    "S3 client not configured. Missing AWS_REGION, S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, or AWS_SECRET_ACCESS_KEY."
  );
}

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID!,
    secretAccessKey: AWS_SECRET_ACCESS_KEY!,
  },
});

type PresignedUrlParams = {
  contentType: string;
  userId: string;
};

export async function getPresignedUploadUrl({ contentType, userId }: PresignedUrlParams) {
  const fileKey = `listing-images/${userId}/${randomUUID()}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: fileKey,
    ContentType: contentType,
    ACL: "public-read", // Make the object publicly readable
  });

  const signedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 60 * 5, // 5 minutes
  });

  const publicUrl = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${fileKey}`;

  return { signedUrl, publicUrl };
}
