import { describe, it, expect } from 'vitest';
import { formatPrice, formatDate, formatDateTime, STATUS_LABELS, STATUS_COLORS } from '../format';

describe('formatPrice', () => {
  it('formata um número em reais', () => {
    expect(formatPrice(89.9)).toBe('R$\u00a089,90');
  });

  it('formata valores inteiros com centavos zerados', () => {
    expect(formatPrice(100)).toBe('R$\u00a0100,00');
  });

  it('trata undefined/null como zero', () => {
    expect(formatPrice(undefined)).toBe('R$\u00a00,00');
    expect(formatPrice(null)).toBe('R$\u00a00,00');
  });

  it('aceita string numérica (como vem da API em campos DECIMAL)', () => {
    expect(formatPrice('149.90')).toBe('R$\u00a0149,90');
  });

  it('formata valores negativos (ex.: desconto)', () => {
    expect(formatPrice(-10)).toBe('-R$\u00a010,00');
  });
});

describe('formatDate', () => {
  it('formata uma data no padrão brasileiro abreviado', () => {
    const result = formatDate('2026-03-15T10:00:00Z');
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2026/);
  });
});

describe('formatDateTime', () => {
  it('inclui hora e minuto além da data', () => {
    const result = formatDateTime('2026-03-15T10:30:00Z');
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/:/);
  });
});

describe('STATUS_LABELS', () => {
  it('tem rótulo em português pra todos os 7 status possíveis do pedido', () => {
    const expectedStatuses = ['aguardando_pagamento', 'pago', 'em_separacao', 'enviado', 'entregue', 'cancelado', 'reembolsado'];
    expectedStatuses.forEach((status) => {
      expect(STATUS_LABELS[status]).toBeTruthy();
      expect(typeof STATUS_LABELS[status]).toBe('string');
    });
  });
});

describe('STATUS_COLORS', () => {
  it('tem uma classe de cor pra cada status que também tem rótulo (nenhum órfão)', () => {
    Object.keys(STATUS_LABELS).forEach((status) => {
      expect(STATUS_COLORS[status]).toBeTruthy();
    });
  });
});
