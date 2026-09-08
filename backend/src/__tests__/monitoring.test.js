const mockInit = jest.fn();
const mockSetupExpressErrorHandler = jest.fn();
const mockCaptureException = jest.fn();

jest.mock('@sentry/node', () => ({
  init: mockInit,
  setupExpressErrorHandler: mockSetupExpressErrorHandler,
  captureException: mockCaptureException,
}));

describe('Monitoramento de erro (monitoring.js)', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    mockInit.mockClear();
    mockSetupExpressErrorHandler.mockClear();
    mockCaptureException.mockClear();
    jest.resetModules();
  });

  it('sem SENTRY_DSN, isConfigured() retorna false', () => {
    delete process.env.SENTRY_DSN;
    const monitoring = require('../integrations/monitoring');
    expect(monitoring.isConfigured()).toBe(false);
  });

  it('sem SENTRY_DSN, initMonitoring() não chama Sentry.init (no-op)', () => {
    delete process.env.SENTRY_DSN;
    const monitoring = require('../integrations/monitoring');
    monitoring.initMonitoring();
    expect(mockInit).not.toHaveBeenCalled();
  });

  it('com SENTRY_DSN configurado, initMonitoring() chama Sentry.init com o DSN certo', () => {
    process.env.SENTRY_DSN = 'https://exemplo@sentry.io/123';
    process.env.NODE_ENV = 'production';
    const monitoring = require('../integrations/monitoring');
    monitoring.initMonitoring();

    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(mockInit.mock.calls[0][0].dsn).toBe('https://exemplo@sentry.io/123');
    expect(mockInit.mock.calls[0][0].environment).toBe('production');
  });

  it('sem SENTRY_DSN, attachExpressErrorHandler() não conecta ao Express (no-op)', () => {
    delete process.env.SENTRY_DSN;
    const monitoring = require('../integrations/monitoring');
    monitoring.attachExpressErrorHandler({});
    expect(mockSetupExpressErrorHandler).not.toHaveBeenCalled();
  });

  it('com SENTRY_DSN configurado, attachExpressErrorHandler() conecta ao Express', () => {
    process.env.SENTRY_DSN = 'https://exemplo@sentry.io/123';
    const monitoring = require('../integrations/monitoring');
    const fakeApp = {};
    monitoring.attachExpressErrorHandler(fakeApp);
    expect(mockSetupExpressErrorHandler).toHaveBeenCalledWith(fakeApp);
  });

  it('sem SENTRY_DSN, captureException() não chama Sentry (no-op, nunca lança erro)', () => {
    delete process.env.SENTRY_DSN;
    const monitoring = require('../integrations/monitoring');
    expect(() => monitoring.captureException(new Error('teste'))).not.toThrow();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('com SENTRY_DSN configurado, captureException() repassa o erro pro Sentry', () => {
    process.env.SENTRY_DSN = 'https://exemplo@sentry.io/123';
    const monitoring = require('../integrations/monitoring');
    const error = new Error('falha de teste');
    monitoring.captureException(error, { orderId: '123' });

    expect(mockCaptureException).toHaveBeenCalledWith(error, { extra: { orderId: '123' } });
  });
});
