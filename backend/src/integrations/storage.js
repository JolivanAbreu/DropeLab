const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

/**
 * Armazenamento de imagem de produto/banner/Instagram. Em produção real,
 * disco local não funciona na maioria dos provedores de hospedagem (Railway,
 * Render e afins têm sistema de arquivos temporário — a imagem some a cada
 * novo deploy). Por isso, se as variáveis de ambiente de um bucket
 * S3-compatível (ex.: Cloudflare R2) estiverem configuradas, o upload vai
 * pra lá. Sem configurar nada, cai automaticamente no disco local — útil
 * pra desenvolvimento sem precisar de credenciais reais de nuvem.
 */
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

  // S3_PUBLIC_URL é o domínio público configurado no bucket (ex.: o
  // subdomínio r2.dev do Cloudflare, ou um domínio próprio) — sem isso,
  // cai para endpoint+bucket, que funciona mas raramente é o ideal em produção.
  const publicBase = (process.env.S3_PUBLIC_URL || `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}`).replace(/\/$/, '');
  return `${publicBase}/${filename}`;
}

function saveToLocalDisk({ buffer, filename, requestBaseUrl }) {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
  return `${requestBaseUrl}/uploads/${filename}`;
}

/**
 * Salva o arquivo e retorna a URL pública — decide automaticamente entre
 * bucket S3-compatível (se configurado) ou disco local (fallback).
 */
async function saveFile({ buffer, originalName, mimetype, requestBaseUrl }) {
  const ext = path.extname(originalName || '').toLowerCase() || '.jpg';
  const filename = `${uuidv4()}${ext}`;

  const url = isObjectStorageConfigured()
    ? await saveToObjectStorage({ buffer, filename, mimetype })
    : saveToLocalDisk({ buffer, filename, requestBaseUrl });

  return { url, filename };
}

module.exports = { saveFile, isObjectStorageConfigured, UPLOADS_DIR };
