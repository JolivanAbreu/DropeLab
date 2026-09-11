// Fallback pra produto sem peso/dimensão cadastrados.
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

// Nunca lança erro pra fora — se a API falhar, retorna lista vazia e a
// loja segue só com as opções fixas (Uber Flash/99/combinar).
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
