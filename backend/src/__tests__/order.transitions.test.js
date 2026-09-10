const { assertValidTransition } = require('../services/order.service');

// CT-31 (correlato): transições de status do pedido devem seguir a máquina de
// estados definida no documento de Arquitetura (seção 5) — pagamento
// acontece na entrega, então "pago" é a confirmação final de que o valor foi
// recebido, registrada depois de "entregue" (não mais um pré-requisito pra
// começar a separar o pedido).
describe('assertValidTransition', () => {
  it('permite aguardando_pagamento -> em_separacao (pedido novo indo pro preparo, sem esperar pagamento online)', () => {
    expect(() => assertValidTransition('aguardando_pagamento', 'em_separacao')).not.toThrow();
  });

  it('permite aguardando_pagamento -> cancelado', () => {
    expect(() => assertValidTransition('aguardando_pagamento', 'cancelado')).not.toThrow();
  });

  it('permite em_separacao -> enviado -> entregue -> pago', () => {
    expect(() => assertValidTransition('em_separacao', 'enviado')).not.toThrow();
    expect(() => assertValidTransition('enviado', 'entregue')).not.toThrow();
    expect(() => assertValidTransition('entregue', 'pago')).not.toThrow();
  });

  it('rejeita pular etapas: aguardando_pagamento -> enviado', () => {
    expect(() => assertValidTransition('aguardando_pagamento', 'enviado')).toThrow(/Transição de status inválida/);
  });

  it('rejeita transição a partir de estado final: pago -> cancelado', () => {
    expect(() => assertValidTransition('pago', 'cancelado')).toThrow();
  });

  it('rejeita reabrir um pedido já entregue direto pra separação', () => {
    expect(() => assertValidTransition('entregue', 'em_separacao')).toThrow();
  });

  it('permite cancelado -> reembolsado', () => {
    expect(() => assertValidTransition('cancelado', 'reembolsado')).not.toThrow();
  });

  it('permite entregue -> reembolsado (devolução na hora da entrega, antes de confirmar pago)', () => {
    expect(() => assertValidTransition('entregue', 'reembolsado')).not.toThrow();
  });

  it('permite pago -> reembolsado (devolução depois do pagamento confirmado)', () => {
    expect(() => assertValidTransition('pago', 'reembolsado')).not.toThrow();
  });
});
