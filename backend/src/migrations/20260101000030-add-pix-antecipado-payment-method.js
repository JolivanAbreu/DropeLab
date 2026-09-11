'use strict';
// Adiciona um quinto valor ao enum de forma de pagamento: "pix_antecipado" —
// usado exclusivamente quando o frete é por transportadora real (Correios/
// Melhor Envio via requiresShippingArrangement=false), onde não existe
// entregador físico pra combinar pagamento na entrega. Os 4 valores
// originais (credit_card, debit_card, cash, pix) continuam representando
// pagamento combinado com quem entrega (Uber Flash/99/combinar).
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TYPE \"enum_orders_payment_method\" ADD VALUE IF NOT EXISTS 'pix_antecipado';"
    );
  },
  down: async () => {
    // Postgres não suporta remover um valor de enum diretamente — reverter
    // exigiria recriar o tipo do zero. Como isso arriscaria dados reais de
    // pedidos já com esse valor, o down é intencionalmente um no-op.
  },
};
