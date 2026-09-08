import { describe, it, expect } from 'vitest';
import { maskCPF, maskPhone, maskCEP, maskCardNumber, maskExpirationMonth, maskExpirationYear, maskCVV, maskUF, unmask } from '../masks';

describe('maskCPF', () => {
  it('formata CPF completo', () => {
    expect(maskCPF('12345678901')).toBe('123.456.789-01');
  });

  it('formata progressivamente enquanto o usuário digita', () => {
    expect(maskCPF('123')).toBe('123');
    expect(maskCPF('1234')).toBe('123.4');
    expect(maskCPF('123456')).toBe('123.456');
    expect(maskCPF('123456789')).toBe('123.456.789');
  });

  it('ignora caracteres não numéricos já digitados', () => {
    expect(maskCPF('123.456.789-01')).toBe('123.456.789-01');
  });

  it('trunca em 11 dígitos', () => {
    expect(maskCPF('123456789019999')).toBe('123.456.789-01');
  });
});

describe('maskPhone', () => {
  it('formata celular (11 dígitos) com o 9 extra', () => {
    expect(maskPhone('85999998888')).toBe('(85) 99999-8888');
  });

  it('formata telefone fixo (10 dígitos)', () => {
    expect(maskPhone('8533334444')).toBe('(85) 3333-4444');
  });

  it('formata progressivamente', () => {
    expect(maskPhone('85')).toBe('85');
    expect(maskPhone('859')).toBe('(85) 9');
  });

  it('trunca em 11 dígitos', () => {
    expect(maskPhone('859999988889999')).toBe('(85) 99999-8888');
  });
});

describe('maskCEP', () => {
  it('formata CEP completo', () => {
    expect(maskCEP('60000000')).toBe('60000-000');
  });

  it('trunca em 8 dígitos', () => {
    expect(maskCEP('600000009999')).toBe('60000-000');
  });
});

describe('maskCardNumber', () => {
  it('agrupa em blocos de 4', () => {
    expect(maskCardNumber('4111111111111111')).toBe('4111 1111 1111 1111');
  });

  it('trunca em 16 dígitos', () => {
    expect(maskCardNumber('41111111111111119999')).toBe('4111 1111 1111 1111');
  });
});

describe('maskExpirationMonth', () => {
  it('completa com zero à esquerda quando o primeiro dígito já indica mês > 1x', () => {
    expect(maskExpirationMonth('2')).toBe('02');
  });

  it('não completa quando o primeiro dígito pode formar 10, 11 ou 12', () => {
    expect(maskExpirationMonth('1')).toBe('1');
  });

  it('trunca em 2 dígitos', () => {
    expect(maskExpirationMonth('1299')).toBe('12');
  });
});

describe('maskExpirationYear', () => {
  it('mantém só dígitos, até 4', () => {
    expect(maskExpirationYear('20/30')).toBe('2030');
    expect(maskExpirationYear('203099')).toBe('2030');
  });
});

describe('maskCVV', () => {
  it('mantém só dígitos, até 4 (Amex tem CVV de 4)', () => {
    expect(maskCVV('123')).toBe('123');
    expect(maskCVV('12345')).toBe('1234');
    expect(maskCVV('12a3')).toBe('123');
  });
});

describe('maskUF', () => {
  it('mantém só letras, maiúsculas, até 2 caracteres', () => {
    expect(maskUF('ce')).toBe('CE');
    expect(maskUF('c3e')).toBe('CE');
    expect(maskUF('ceara')).toBe('CE');
  });
});

describe('unmask', () => {
  it('remove toda formatação, deixando só dígitos', () => {
    expect(unmask('123.456.789-01')).toBe('12345678901');
    expect(unmask('(85) 99999-8888')).toBe('85999998888');
    expect(unmask('60000-000')).toBe('60000000');
  });

  it('trata valor vazio/undefined sem quebrar', () => {
    expect(unmask('')).toBe('');
    expect(unmask(undefined)).toBe('');
  });
});
