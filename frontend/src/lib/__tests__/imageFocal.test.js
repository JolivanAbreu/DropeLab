import { describe, it, expect } from 'vitest';
import { focalPointToCss, FOCAL_POINT_OPTIONS } from '../imageFocal';

describe('focalPointToCss', () => {
  it('mapeia os três presets pro valor CSS correto', () => {
    expect(focalPointToCss('top')).toBe('center top');
    expect(focalPointToCss('center')).toBe('center center');
    expect(focalPointToCss('bottom')).toBe('center bottom');
  });

  it('usa centro como fallback pra valor desconhecido, nulo ou vazio', () => {
    expect(focalPointToCss('valor-invalido')).toBe('center center');
    expect(focalPointToCss(null)).toBe('center center');
    expect(focalPointToCss(undefined)).toBe('center center');
    expect(focalPointToCss('')).toBe('center center');
  });
});

describe('FOCAL_POINT_OPTIONS', () => {
  it('tem exatamente as 3 opções, em pares [valor, rótulo]', () => {
    expect(FOCAL_POINT_OPTIONS).toHaveLength(3);
    FOCAL_POINT_OPTIONS.forEach(([value, label]) => {
      expect(typeof value).toBe('string');
      expect(typeof label).toBe('string');
    });
  });

  it('cada valor de FOCAL_POINT_OPTIONS produz um CSS reconhecido (não cai no fallback genérico)', () => {
    const producedCss = FOCAL_POINT_OPTIONS.map(([value]) => focalPointToCss(value));
    expect(producedCss).toContain('center top');
    expect(producedCss).toContain('center center');
    expect(producedCss).toContain('center bottom');
  });
});
