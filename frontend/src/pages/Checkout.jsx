import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Landmark, Banknote, QrCode } from 'lucide-react';
import { api, ApiError } from '../api/client';
import { useCart } from '../context/CartContext';
import Field, { inputClass } from '../components/Field';
import Button from '../components/Button';
import { ErrorNotice, LoadingBlock } from '../components/States';
import { formatPrice } from '../lib/format';
import { maskCEP, maskUF } from '../lib/masks';
import { useCepAutofill } from '../lib/useCepAutofill';
import CashChangeModal from '../components/CashChangeModal';

const STEPS = ['Endereço', 'Frete', 'Pagamento'];

const PAYMENT_METHODS = [
  { id: 'credit_card', label: 'Cartão de Crédito', icon: CreditCard, hint: 'Na maquininha, na entrega' },
  { id: 'debit_card', label: 'Cartão de Débito', icon: Landmark, hint: 'Na maquininha, na entrega' },
  { id: 'cash', label: 'Dinheiro', icon: Banknote, hint: 'Combine o troco agora' },
  { id: 'pix', label: 'Pix', icon: QrCode, hint: 'Chave enviada na entrega' },
];

export default function Checkout() {
  const { cart, refresh, coupon } = useCart();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [addresses, setAddresses] = useState(null);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [newAddress, setNewAddress] = useState({ street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zip: '' });
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const { handleCepChange, loadingCep, cepNotFound } = useCepAutofill(setNewAddress);

  const [shippingOptions, setShippingOptions] = useState(null);
  const [selectedShipping, setSelectedShipping] = useState(null);

  // Cupom aplicado na sacola já vem pré-preenchido aqui, sem precisar digitar de novo.
  const [couponCode, setCouponCode] = useState(coupon?.code || '');
  const [couponResult, setCouponResult] = useState(coupon ? { discount: coupon.discount } : null);
  const [couponError, setCouponError] = useState('');

  // Pagamento acontece na entrega — aqui só se escolhe COMO, pro entregador
  // já saber se precisa levar maquininha ou troco.
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [showCashModal, setShowCashModal] = useState(false);
  const [changeFor, setChangeFor] = useState(null);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/addresses').then((data) => {
      setAddresses(data);
      const defaultAddr = data.find((a) => a.isDefault) || data[0];
      if (defaultAddr) setSelectedAddressId(defaultAddr.id);
      else setShowNewAddressForm(true);
    });
  }, []);

  async function handleCreateAddress(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const created = await api.post('/addresses', { ...newAddress, isDefault: true });
      setAddresses((prev) => [...(prev || []), created]);
      setSelectedAddressId(created.id);
      setShowNewAddressForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o endereço.');
    } finally {
      setLoading(false);
    }
  }

  async function goToShipping() {
    if (!selectedAddressId) {
      setError('Selecione ou cadastre um endereço.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const address = addresses.find((a) => a.id === selectedAddressId);
      const options = await api.post('/cart/shipping-quote', { zip: address.zip });
      setShippingOptions(options);
      setSelectedShipping(options[0]?.id || null);
      setStep(1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível calcular o frete.');
    } finally {
      setLoading(false);
    }
  }

  async function applyCoupon() {
    setCouponError('');
    if (!couponCode) return;
    try {
      const result = await api.post('/coupons/validate', { code: couponCode });
      setCouponResult(result);
    } catch (err) {
      setCouponResult(null);
      setCouponError(err instanceof ApiError ? err.message : 'Cupom inválido.');
    }
  }

  function handleSelectPaymentMethod(methodId) {
    setError('');
    if (methodId === 'cash') {
      setShowCashModal(true);
      return;
    }
    setPaymentMethod(methodId);
    setChangeFor(null);
  }

  function handleCashConfirm(amount) {
    setPaymentMethod('cash');
    setChangeFor(amount); // null quando não precisa de troco
    setShowCashModal(false);
  }

  async function handleFinalizeOrder() {
    if (!paymentMethod) {
      setError('Escolha uma forma de pagamento.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const order = await api.post('/orders', {
        address_id: selectedAddressId,
        shipping_option_id: selectedShipping,
        coupon_code: couponResult ? couponCode : undefined,
        payment_method: paymentMethod,
        change_for: changeFor,
      });
      refresh();
      navigate(`/minha-conta/pedidos/${order.id}`, { state: { justCreated: true } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar o pedido.');
    } finally {
      setLoading(false);
    }
  }

  const shippingCost = shippingOptions?.find((o) => o.id === selectedShipping)?.price || 0;
  const discount = couponResult?.discount || 0;
  const total = cart.subtotal - discount + shippingCost;

  if (addresses === null) return <div className="mx-auto max-w-7xl px-2.5 py-10 sm:px-4"><LoadingBlock label="Carregando checkout" /></div>;

  return (
    <div className="mx-auto max-w-7xl px-2.5 py-4 sm:px-4">
      <div className="rounded-lg bg-white p-6 shadow-[0_4px_15px_rgba(0,0,0,0.05)]">
        <h1 className="flex items-center gap-2.5 border-b-2 border-ink pb-4 text-[22px] font-black uppercase text-[#111111]">
          🔒 Finalizar Compra
        </h1>

        {/* Indicador de etapas — numeradas, conectadas por uma linha,
            passo atual/concluído em verde neon, os demais neutros. */}
        <div className="relative mt-6 flex items-start justify-between px-2 sm:px-8">
          <div className="absolute left-[10%] right-[10%] top-[15px] h-[3px] rounded bg-line" />
          <div
            className="absolute left-[10%] top-[15px] h-[3px] rounded bg-tag transition-all duration-500"
            style={{ width: `${(Math.min(step, 2) / 2) * 80}%` }}
          />
          {STEPS.map((label, i) => (
            <div key={label} className="relative z-[1] flex flex-1 flex-col items-center gap-2 text-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-black ${
                  i < step ? 'border-ink bg-ink text-tag' : i === step ? 'border-ink bg-tag text-ink shadow-[0_0_0_4px_rgba(0,253,119,0.25)]' : 'border-line bg-canvas text-ink-soft'
                }`}
              >
                {i < step ? '✓' : i + 1}
              </div>
              <p className={`text-[10px] font-black uppercase tracking-wide ${i <= step ? 'text-[#111111]' : 'text-ink-soft'}`}>{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[2fr_1fr]">
          <div>
            {step === 0 && (
              <div className="space-y-5">
                {addresses.length > 0 && !showNewAddressForm && (
                  <div className="space-y-3">
                    {addresses.map((addr) => (
                      <label
                        key={addr.id}
                        className={`block cursor-pointer rounded-lg border p-4 transition-colors ${selectedAddressId === addr.id ? 'border-[#111111] bg-canvas' : 'border-line hover:border-ink'}`}
                      >
                        <input type="radio" name="address" className="mr-2 accent-tag" checked={selectedAddressId === addr.id} onChange={() => setSelectedAddressId(addr.id)} />
                        <span className="text-sm text-[#333333]">{addr.street}, {addr.number} — {addr.neighborhood}, {addr.city}/{addr.state} · {addr.zip}</span>
                      </label>
                    ))}
                    <button onClick={() => setShowNewAddressForm(true)} className="font-mono text-xs uppercase text-ink-soft underline decoration-dotted hover:text-tag-dark">
                      + cadastrar novo endereço
                    </button>
                  </div>
                )}

                {showNewAddressForm && (
                  <form onSubmit={handleCreateAddress} className="space-y-4 rounded-lg border border-line bg-[#fafafa] p-5">
                    <Field label="CEP" hint={loadingCep ? 'Buscando endereço...' : cepNotFound ? 'CEP não encontrado — preencha manualmente' : 'Digite o CEP para preencher o resto automaticamente'}>
                      <input required className={inputClass} value={newAddress.zip} onChange={(e) => handleCepChange(maskCEP(e.target.value))} placeholder="00000-000" />
                    </Field>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <Field label="Rua"><input required className={inputClass} value={newAddress.street} onChange={(e) => setNewAddress({ ...newAddress, street: e.target.value })} /></Field>
                      </div>
                      <Field label="Número"><input required className={inputClass} value={newAddress.number} onChange={(e) => setNewAddress({ ...newAddress, number: e.target.value })} /></Field>
                    </div>
                    <Field label="Complemento (opcional)"><input className={inputClass} value={newAddress.complement} onChange={(e) => setNewAddress({ ...newAddress, complement: e.target.value })} /></Field>
                    <Field label="Bairro"><input required className={inputClass} value={newAddress.neighborhood} onChange={(e) => setNewAddress({ ...newAddress, neighborhood: e.target.value })} /></Field>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <Field label="Cidade"><input required className={inputClass} value={newAddress.city} onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })} /></Field>
                      </div>
                      <Field label="UF"><input required maxLength={2} className={inputClass} value={newAddress.state} onChange={(e) => setNewAddress({ ...newAddress, state: maskUF(e.target.value) })} /></Field>
                    </div>
                    <div className="flex gap-3">
                      <Button type="submit" variant="tag" disabled={loading}>Salvar endereço</Button>
                      {addresses.length > 0 && (
                        <Button type="button" variant="ghost" onClick={() => setShowNewAddressForm(false)}>Cancelar</Button>
                      )}
                    </div>
                  </form>
                )}

                <ErrorNotice message={error} />
                {!showNewAddressForm && (
                  <Button variant="tag" size="lg" onClick={goToShipping} disabled={loading}>
                    {loading ? 'Calculando frete...' : 'Continuar para o frete →'}
                  </Button>
                )}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6">
                <div className="space-y-3">
                  {shippingOptions?.map((option) => (
                    <label
                      key={option.id}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border p-4 transition-colors ${selectedShipping === option.id ? 'border-[#111111] bg-canvas' : 'border-line hover:border-ink'}`}
                    >
                      <span className="flex items-center gap-3">
                        <input type="radio" name="shipping" className="accent-tag" checked={selectedShipping === option.id} onChange={() => setSelectedShipping(option.id)} />
                        <span>
                          <span className="block text-sm font-black uppercase text-[#111111]">{option.name}</span>
                          <span className="font-mono text-xs text-ink-soft">
                            {option.requiresArrangement
                              ? (option.note || 'Combinado após a compra')
                              : option.estimatedDays === 0
                                ? 'Entrega no mesmo dia'
                                : `até ${option.estimatedDays} dias úteis`}
                          </span>
                        </span>
                      </span>
                      <span className="font-mono text-sm font-black text-[#111111]">
                        {option.contactMethod === 'customer_app'
                          ? 'ver no app'
                          : option.price > 0
                            ? formatPrice(option.price)
                            : 'a combinar'}
                      </span>
                    </label>
                  ))}
                </div>

                <div className="rounded-lg border border-line bg-[#fafafa] p-4">
                  <h4 className="text-xs font-black uppercase text-[#111111]">🎟 Cupom de desconto</h4>
                  <div className="mt-3 flex gap-2">
                    <input
                      className="min-w-0 flex-1 rounded border border-[#cccccc] px-3 py-2.5 text-xs uppercase text-[#111111] outline-none focus:border-[#111111]"
                      placeholder="BEMVINDA10"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    />
                    <button type="button" onClick={applyCoupon} className="whitespace-nowrap rounded bg-[#111111] px-4 font-mono text-[11px] font-black uppercase text-white hover:bg-black">
                      Aplicar
                    </button>
                  </div>
                  {couponResult && <p className="mt-2 text-xs font-bold text-tag-dark">cupom aplicado: −{formatPrice(couponResult.discount)}</p>}
                  {couponError && <p className="mt-2 text-xs font-bold text-danger">{couponError}</p>}
                </div>

                <ErrorNotice message={error} />
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => setStep(0)}>← Voltar</Button>
                  <Button variant="tag" size="lg" onClick={() => setStep(2)} disabled={loading || !selectedShipping}>
                    Continuar para o pagamento →
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="rounded-lg border border-line bg-[#fafafa] p-4">
                  <p className="text-xs text-ink-soft">
                    O pagamento é feito <strong>na entrega</strong> — escolha aqui só a forma, pra o entregador já ir preparado.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {PAYMENT_METHODS.map(({ id, label, icon: Icon, hint }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleSelectPaymentMethod(id)}
                      className={`flex flex-col items-center gap-2 rounded-lg border p-5 text-center transition-colors ${paymentMethod === id ? 'border-[#111111] bg-canvas' : 'border-line hover:border-ink'}`}
                    >
                      <Icon className="h-6 w-6" strokeWidth={1.75} />
                      <span className="text-xs font-black uppercase text-[#111111]">{label}</span>
                      <span className="font-mono text-[10px] text-ink-soft">{hint}</span>
                    </button>
                  ))}
                </div>

                {paymentMethod === 'cash' && (
                  <p className="text-xs font-bold text-tag-dark">
                    {changeFor ? `Pagamento em dinheiro — troco pra ${formatPrice(changeFor)} (troco: ${formatPrice(changeFor - total)})` : 'Pagamento em dinheiro — sem troco'}
                    {' · '}
                    <button type="button" onClick={() => setShowCashModal(true)} className="underline decoration-dotted">alterar</button>
                  </p>
                )}

                <ErrorNotice message={error} />
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => setStep(1)}>← Voltar</Button>
                  <Button variant="tag" size="lg" onClick={handleFinalizeOrder} disabled={loading || !paymentMethod}>
                    {loading ? 'Finalizando pedido...' : 'Finalizar pedido →'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <aside className="h-fit rounded-lg border border-line bg-[#fafafa] p-5 lg:sticky lg:top-24">
            <h2 className="border-b-2 border-ink pb-3 text-sm font-black uppercase text-[#111111]">Resumo</h2>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between text-[#333333]"><span>Subtotal</span><span>{formatPrice(cart.subtotal)}</span></div>
              {discount > 0 && <div className="flex justify-between text-danger"><span>Desconto</span><span>−{formatPrice(discount)}</span></div>}
              <div className="flex justify-between text-[#333333]"><span>Frete</span><span>{shippingCost ? formatPrice(shippingCost) : '—'}</span></div>
              <div className="flex justify-between border-t border-line pt-2.5 text-sm font-black text-[#111111]"><span>Total</span><span className="text-base">{formatPrice(total)}</span></div>
            </div>
          </aside>
        </div>
      </div>

      {showCashModal && (
        <CashChangeModal
          total={total}
          onConfirm={handleCashConfirm}
          onCancel={() => setShowCashModal(false)}
        />
      )}
    </div>
  );
}
