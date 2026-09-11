const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

// Sem bucket configurado, cai no disco local — não sobrevive a redeploy
// na maioria dos provedores (Railway, Render etc.), mas ok pra desenvolvimento.
function isObjectStorageConfigured() {
  return !!(
    process.env.S3_BUCKET &&
    process.env.S3_ENDPOINT &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY
  );
}

let cachedClient = null;
function getClient() {
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: process.env.S3_REGION || 'auto',
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    });
  }
  return cachedClient;
}

async function saveToObjectStorage({ buffer, filename, mimetype }) {
  const client = getClient();
  await client.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: filename,
    Body: buffer,
    ContentType: mimetype,
  }));

  const publicBase = (process.env.S3_PUBLIC_URL || `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}`).replace(/\/$/, '');
  return `${publicBase}/${filename}`;
}

function saveToLocalDisk({ buffer, filename, requestBaseUrl }) {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
  return `${requestBaseUrl}/uploads/${filename}`;
}

async function saveFile({ buffer, originalName, mimetype, requestBaseUrl }) {
  const ext = path.extname(originalName || '').toLowerCase() || '.jpg';
  const filename = `${uuidv4()}${ext}`;

  const url = isObjectStorageConfigured()
    ? await saveToObjectStorage({ buffer, filename, mimetype })
    : saveToLocalDisk({ buffer, filename, requestBaseUrl });

  return { url, filename };
}

module.exports = { saveFile, isObjectStorageConfigured, UPLOADS_DIR };
