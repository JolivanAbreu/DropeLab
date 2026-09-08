// Valores padrão pra item sem peso/dimensão cadastrados — uma camiseta ou
// blusa oversized dobrada cabe razoavelmente numa caixa desse tamanho. É
// uma estimativa conservadora (peca pro lado de "cotação um pouco mais
// cara" em vez de "pacote rejeitado por dimensão insuficiente"), usada só
// como fallback pra produtos cadastrados antes de existir esse campo.
const DEFAULT_ITEM = { weightKg: 0.3, heightCm: 5, widthCm: 25, lengthCm: 20 };

function isConfigured() {
  return !!(process.env.MELHOR_ENVIO_TOKEN && process.env.STORE_POSTAL_CODE);
}

function getBaseUrl() {
  return process.env.MELHOR_ENVIO_SANDBOX === 'false'
    ? 'https://www.melhorenvio.com.br'
    : 'https://sandbox.melhorenvio.com.br';
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

/**
 * Cotação de frete real por CEP, via Melhor Envio — retorna uma lista de
 * serviços de transportadora (PAC, SEDEX, Jadlog etc.) com preço e prazo
 * reais para o CEP de destino informado. Nunca lança erro pra fora: se a
 * API estiver fora do ar, mal configurada, ou o CEP não for atendido,
 * retorna lista vazia — a loja continua funcionando só com as opções
 * fixas (Uber Flash/99/combinar) nesse caso, sem quebrar o checkout.
 */
async function quoteByCep({ toPostalCode, items }) {
  if (!isConfigured()) return [];

  const products = items.map((item, index) => {
    const variant = item.variant || item;
    return {
      id: variant.sku || `item-${index}`,
      width: Number(variant.widthCm) || DEFAULT_ITEM.widthCm,
      height: Number(variant.heightCm) || DEFAULT_ITEM.heightCm,
      length: Number(variant.lengthCm) || DEFAULT_ITEM.lengthCm,
      weight: Number(variant.weightKg) || DEFAULT_ITEM.weightKg,
      insurance_value: Number(variant.priceOverride || variant.product?.basePrice) || 10,
      quantity: item.quantity || 1,
    };
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${getBaseUrl()}/api/v2/me/shipment/calculate`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${process.env.MELHOR_ENVIO_TOKEN}`,
        // Exigido pela API — nome da aplicação + e-mail de contato técnico.
        'User-Agent': process.env.MELHOR_ENVIO_USER_AGENT || 'Dravennx (contato@dravennx.com.br)',
      },
      body: JSON.stringify({
        from: { postal_code: onlyDigits(process.env.STORE_POSTAL_CODE) },
        to: { postal_code: onlyDigits(toPostalCode) },
        products,
      }),
    });

    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error(`[melhorenvio] resposta ${res.status} da API — cotação por CEP indisponível nesta compra.`);
      return [];
    }

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    // Serviços com "error" preenchido não estão disponíveis pra essa rota
    // (ex.: transportadora não atende a região) — descarta em vez de
    // mostrar uma opção quebrada pro cliente escolher.
    return data
      .filter((quote) => !quote.error && quote.price)
      .map((quote) => ({
        id: `me-${quote.id}`,
        name: `${quote.company?.name || 'Transportadora'} — ${quote.name}`,
        price: Number(quote.custom_price ?? quote.price),
        estimatedDays: quote.custom_delivery_time ?? quote.delivery_time ?? null,
        note: null,
        requiresArrangement: false,
        contactMethod: null,
      }));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[melhorenvio] falha ao cotar frete:', err.message);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { quoteByCep, isConfigured };
