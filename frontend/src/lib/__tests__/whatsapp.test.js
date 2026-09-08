import { describe, it, expect } from 'vitest';
import { buildShippingWhatsAppLink, buildGeneralWhatsAppLink, buildAdminContactWhatsAppLink } from '../whatsapp';

describe('buildGeneralWhatsAppLink', () => {
  it('monta a URL do wa.me com o número informado', () => {
    const link = buildGeneralWhatsAppLink('5585999998888');
    expect(link).toContain('https://wa.me/5585999998888');
    expect(link).toContain('text=');
  });

  it('a mensagem embutida menciona a Dravennx', () => {
    const link = buildGeneralWhatsAppLink('5585999998888');
    const decoded = decodeURIComponent(link.split('text=')[1]);
    expect(decoded).toMatch(/Dravennx/i);
  });
});

describe('buildShippingWhatsAppLink', () => {
  const baseOrder = {
    orderNumber: 'BOS-2026-000123',
    subtotal: 150,
    items: [
      { quantity: 2, variant: { size: 'M', color: 'Preto', product: { name: 'Camiseta Teste' } } },
    ],
    address: { street: 'Rua Teste', number: '100', neighborhood: 'Centro', city: 'Fortaleza', state: 'CE', zip: '60000-000' },
  };

  it('inclui o número do pedido na mensagem', () => {
    const link = buildShippingWhatsAppLink('5585999998888', baseOrder);
    const decoded = decodeURIComponent(link);
    expect(decoded).toContain('BOS-2026-000123');
  });

  it('inclui o resumo dos itens (quantidade, produto, tamanho, cor)', () => {
    const link = buildShippingWhatsAppLink('5585999998888', baseOrder);
    const decoded = decodeURIComponent(link);
    expect(decoded).toContain('2x Camiseta Teste (M/Preto)');
  });

  it('inclui o endereço de entrega formatado', () => {
    const link = buildShippingWhatsAppLink('5585999998888', baseOrder);
    const decoded = decodeURIComponent(link);
    expect(decoded).toContain('Rua Teste, 100');
    expect(decoded).toContain('60000-000');
  });

  it('não quebra quando o pedido não tem endereço carregado', () => {
    const orderSemEndereco = { ...baseOrder, address: null };
    expect(() => buildShippingWhatsAppLink('5585999998888', orderSemEndereco)).not.toThrow();
  });

  it('não quebra quando o pedido não tem itens carregados', () => {
    const orderSemItens = { ...baseOrder, items: [] };
    expect(() => buildShippingWhatsAppLink('5585999998888', orderSemItens)).not.toThrow();
  });
});

describe('buildAdminContactWhatsAppLink', () => {
  const order = { orderNumber: 'BOS-2026-000456' };

  it('adiciona o código do país (55) quando o telefone não tem', () => {
    const link = buildAdminContactWhatsAppLink('85999998888', order);
    expect(link).toContain('https://wa.me/5585999998888');
  });

  it('não duplica o código do país se o telefone já vier completo', () => {
    const link = buildAdminContactWhatsAppLink('5585999998888', order);
    expect(link).toContain('https://wa.me/5585999998888');
    expect(link).not.toContain('555585999998888');
  });

  it('remove formatação do telefone (parênteses, traço, espaço) antes de montar o link', () => {
    const link = buildAdminContactWhatsAppLink('(85) 99999-8888', order);
    expect(link).toContain('https://wa.me/5585999998888');
  });

  it('inclui o número do pedido na mensagem', () => {
    const link = buildAdminContactWhatsAppLink('85999998888', order);
    const decoded = decodeURIComponent(link);
    expect(decoded).toContain('BOS-2026-000456');
  });
});
