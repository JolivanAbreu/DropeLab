const ApiError = require('../utils/apiError');
const melhorEnvio = require('./melhorEnvio');

// Uber Flash/99: apps externos, o cliente paga a corrida por lá (price: 0,
// contactMethod: 'customer_app'). Combinar: a loja entra em contato
// (contactMethod: 'store'). Com Melhor Envio configurado, essas opções
// fixas vêm acrescidas de cotações reais de transportadora; sem isso ou se
// a API falhar, segue só com as fixas — nunca quebra o checkout.
async function quoteShipping({ zip, items }) {
  try {
    const fixedOptions = [
      {
        id: 'uberflex',
        name: 'Uber Flash',
        price: 0,
        estimatedDays: 0,
        note: 'Peça a coleta direto no app Uber — o valor da corrida aparece por lá.',
        requiresArrangement: true,
        contactMethod: 'customer_app',
      },
      {
        id: '99flex',
        name: '99',
        price: 0,
        estimatedDays: 0,
        note: 'Peça a coleta direto no app 99 — o valor da corrida aparece por lá.',
        requiresArrangement: true,
        contactMethod: 'customer_app',
      },
      {
        id: 'combinar',
        name: 'Combinar com o vendedor',
        price: 0,
        estimatedDays: null,
        note: 'Nossa equipe entra em contato por WhatsApp/telefone para combinar a entrega',
        requiresArrangement: true,
        contactMethod: 'store',
      },
    ];

    const carrierOptions = await melhorEnvio.quoteByCep({ toPostalCode: zip, items: items || [] });

    return [...fixedOptions, ...carrierOptions];
  } catch (err) {
    throw ApiError.badRequest('Não foi possível calcular o frete para o CEP informado', 'shipping_unavailable');
  }
}

module.exports = { quoteShipping };
