const fs = require('fs');
const path = require('path');

// Mocka o cliente S3 inteiro — não faz sentido (nem é possível, sem
// credenciais reais) testar contra um bucket R2/S3 de verdade aqui. O que
// importa validar é que storage.js CHAMA o cliente certo com os parâmetros
// certos quando configurado, e monta a URL pública corretamente.
const mockSend = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

describe('Armazenamento de imagem (storage.js)', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    mockSend.mockClear();
    jest.resetModules();
  });

  it('sem variáveis de bucket configuradas, isObjectStorageConfigured() retorna false', () => {
    delete process.env.S3_BUCKET;
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;

    const storageService = require('../integrations/storage');
    expect(storageService.isObjectStorageConfigured()).toBe(false);
  });

  it('com todas as variáveis configuradas, isObjectStorageConfigured() retorna true', () => {
    process.env.S3_BUCKET = 'dravennx-uploads';
    process.env.S3_ENDPOINT = 'https://exemplo.r2.cloudflarestorage.com';
    process.env.S3_ACCESS_KEY_ID = 'chave';
    process.env.S3_SECRET_ACCESS_KEY = 'segredo';

    const storageService = require('../integrations/storage');
    expect(storageService.isObjectStorageConfigured()).toBe(true);
  });

  it('sem bucket configurado, saveFile grava em disco local e retorna URL baseada na requisição', async () => {
    delete process.env.S3_BUCKET;
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;

    const storageService = require('../integrations/storage');
    const result = await storageService.saveFile({
      buffer: Buffer.from('conteúdo de teste'),
      originalName: 'foto.png',
      mimetype: 'image/png',
      requestBaseUrl: 'http://localhost:3000',
    });

    expect(result.url).toMatch(/^http:\/\/localhost:3000\/uploads\/.+\.png$/);
    expect(mockSend).not.toHaveBeenCalled();

    const savedPath = path.join(storageService.UPLOADS_DIR, result.filename);
    expect(fs.existsSync(savedPath)).toBe(true);
    fs.unlinkSync(savedPath); // limpa o arquivo de teste
  });

  it('com bucket configurado, saveFile chama o cliente S3 (não grava em disco) e monta a URL a partir de S3_PUBLIC_URL', async () => {
    process.env.S3_BUCKET = 'dravennx-uploads';
    process.env.S3_ENDPOINT = 'https://exemplo.r2.cloudflarestorage.com';
    process.env.S3_ACCESS_KEY_ID = 'chave';
    process.env.S3_SECRET_ACCESS_KEY = 'segredo';
    process.env.S3_PUBLIC_URL = 'https://pub-teste.r2.dev';

    const storageService = require('../integrations/storage');
    const result = await storageService.saveFile({
      buffer: Buffer.from('conteúdo de teste'),
      originalName: 'banner.jpg',
      mimetype: 'image/jpeg',
      requestBaseUrl: 'http://localhost:3000',
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    const sentCommand = mockSend.mock.calls[0][0];
    expect(sentCommand.input.Bucket).toBe('dravennx-uploads');
    expect(sentCommand.input.ContentType).toBe('image/jpeg');
    expect(result.url).toBe(`https://pub-teste.r2.dev/${result.filename}`);
    expect(result.url).not.toContain('localhost');
  });

  it('com bucket configurado mas sem S3_PUBLIC_URL, monta a URL a partir de endpoint+bucket', async () => {
    process.env.S3_BUCKET = 'dravennx-uploads';
    process.env.S3_ENDPOINT = 'https://exemplo.r2.cloudflarestorage.com';
    process.env.S3_ACCESS_KEY_ID = 'chave';
    process.env.S3_SECRET_ACCESS_KEY = 'segredo';
    delete process.env.S3_PUBLIC_URL;

    const storageService = require('../integrations/storage');
    const result = await storageService.saveFile({
      buffer: Buffer.from('x'),
      originalName: 'foto.webp',
      mimetype: 'image/webp',
      requestBaseUrl: 'http://localhost:3000',
    });

    expect(result.url).toBe(`https://exemplo.r2.cloudflarestorage.com/dravennx-uploads/${result.filename}`);
  });
});
