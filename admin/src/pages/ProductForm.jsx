import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, uploadFile } from '../api/client';
import Field, { inputClass } from '../components/Field';
import Button from '../components/Button';
import ImageCropModal from '../components/ImageCropModal';
import { ErrorNotice, LoadingBlock } from '../components/States';

const SIZES = ['P', 'M', 'G', 'GG', 'XG'];
let tempIdCounter = 0;
const nextTempId = () => `temp-${++tempIdCounter}`;
const isTemp = (tempId) => String(tempId).startsWith('temp-');

const emptyVariant = () => ({ tempId: nextTempId(), size: 'M', color: '', sku: '', stockQuantity: 0, priceOverride: '', weightKg: '', heightCm: '', widthCm: '', lengthCm: '' });
const emptyImage = () => ({ tempId: nextTempId(), url: '' });

function StockAdjuster({ variant, onAdjusted }) {
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function apply() {
    if (!delta || !reason) {
      setError('Informe a quantidade e o motivo.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const updated = await api.put(`/admin/variants/${variant.id}/stock`, { delta: Number(delta), reason });
      onAdjusted(updated.stockQuantity);
      setOpen(false);
      setDelta('');
      setReason('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível ajustar.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-ink-soft underline decoration-dotted hover:text-tag">
        Ajustar estoque
      </button>
    );
  }

  return (
    <div className="col-span-12 mt-2 flex flex-wrap items-end gap-2 rounded-md bg-canvas p-3">
      <Field label="Ajuste (+/-)">
        <input type="number" className={`${inputClass} w-28`} value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="ex.: -3" />
      </Field>
      <Field label="Motivo">
        <input className={`${inputClass} w-56`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ex.: avaria, inventário" />
      </Field>
      <Button type="button" size="sm" onClick={apply} disabled={busy}>{busy ? 'Aplicando...' : 'Aplicar'}</Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
      {error && <span className="w-full text-xs text-danger-bg">{error}</span>}
    </div>
  );
}

export default function ProductForm() {
  const { id } = useParams();
  const isEditing = !!id;
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    categoryId: '', name: '', slug: '', description: '', fabric: '', careInstructions: '', basePrice: '', active: true, featuredSlot: '', badgeLabel: '',
  });
  const [variants, setVariants] = useState([emptyVariant()]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [cropQueue, setCropQueue] = useState([]); // File[] aguardando recorte, um de cada vez
  const [cropQueueTotal, setCropQueueTotal] = useState(0); // tamanho do lote original, pra mostrar "1 de 3"
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [recropTarget, setRecropTarget] = useState(null); // { tempId, url } — recorte de uma foto JÁ cadastrada

  // Gera uma URL temporária pro arquivo no topo da fila de recorte, e
  // libera a anterior da memória quando troca ou quando a fila esvazia.
  useEffect(() => {
    if (cropQueue.length === 0) {
      setCropImageSrc(null);
      return;
    }
    const url = URL.createObjectURL(cropQueue[0]);
    setCropImageSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [cropQueue]);

  useEffect(() => {
    api.get('/categories', { auth: false }).then(setCategories);
  }, []);

  useEffect(() => {
    if (!isEditing) return;
    api.get(`/admin/products/${id}`).then((data) => {
      setForm({
        categoryId: data.categoryId,
        name: data.name,
        slug: data.slug,
        description: data.description || '',
        fabric: data.fabric || '',
        careInstructions: data.careInstructions || '',
        basePrice: data.basePrice,
        active: data.active,
        featuredSlot: data.featuredSlot || '',
        badgeLabel: data.badgeLabel || '',
      });
      setVariants(data.variants.length ? data.variants.map((v) => ({ ...v, tempId: v.id })) : [emptyVariant()]);
      setImages(data.images.map((img) => ({ ...img, tempId: img.id })));
      setLoading(false);
    });
  }, [id, isEditing]);

  function slugify(text) {
    return text.toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function updateVariant(tempId, patch) {
    setVariants((prev) => prev.map((v) => (v.tempId === tempId ? { ...v, ...patch } : v)));
  }
  function removeVariant(tempId) {
    setVariants((prev) => prev.filter((v) => v.tempId !== tempId));
  }
  function updateImage(tempId, patch) {
    setImages((prev) => prev.map((img) => (img.tempId === tempId ? { ...img, ...patch } : img)));
  }
  function removeImage(tempId) {
    setImages((prev) => prev.filter((img) => img.tempId !== tempId));
  }

  async function handleFileUpload(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // permite selecionar os mesmos arquivos de novo depois
    if (files.length === 0) return;

    setUploadError('');
    // Cada foto passa pelo recorte individualmente (é uma interação manual
    // — arrastar/zoom — não dá pra automatizar em lote). A fila processa
    // uma de cada vez; cancelar uma não trava as próximas da lista.
    setCropQueue(files);
    setCropQueueTotal(files.length);
  }

  async function uploadCroppedFile(file) {
    setUploadingImage(true);
    setUploadError('');
    try {
      const result = await uploadFile('/admin/uploads', file);
      setImages((prev) => [...prev, { tempId: nextTempId(), url: result.url }]);
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : 'Não foi possível enviar a imagem.');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleCropConfirm(croppedFile) {
    await uploadCroppedFile(croppedFile);
    setCropQueue((prev) => prev.slice(1));
  }

  function handleCropCancel() {
    setCropQueue((prev) => prev.slice(1));
  }

  /**
   * Reabre o recorte pra uma foto JÁ cadastrada (mesmo já tendo sido salva
   * antes) — funciona tanto pra imagem enviada nesta sessão quanto pra uma
   * de um produto que já existia. Sobe a nova versão recortada como um
   * arquivo novo e substitui só a URL daquela posição na lista, sem afetar
   * as outras fotos.
   */
  async function handleRecropConfirm(croppedFile) {
    setUploadingImage(true);
    setUploadError('');
    try {
      const result = await uploadFile('/admin/uploads', croppedFile);
      updateImage(recropTarget.tempId, { url: result.url });
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : 'Não foi possível salvar o novo recorte.');
    } finally {
      setUploadingImage(false);
      setRecropTarget(null);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.categoryId) {
      setError('Selecione uma categoria.');
      return;
    }
    if (variants.length === 0) {
      setError('Cadastre ao menos uma variação (tamanho/cor).');
      return;
    }
    for (const v of variants) {
      if (!v.color || !v.sku) {
        setError('Toda variação precisa de cor e SKU preenchidos.');
        return;
      }
    }

    const payload = {
      ...form,
      basePrice: Number(form.basePrice),
      featuredSlot: form.featuredSlot || null,
      badgeLabel: form.badgeLabel || null,
      variants: variants.map((v) => ({
        ...(isTemp(v.tempId) ? {} : { id: v.id }),
        size: v.size,
        color: v.color,
        sku: v.sku,
        stockQuantity: Number(v.stockQuantity),
        priceOverride: v.priceOverride ? Number(v.priceOverride) : null,
        weightKg: v.weightKg ? Number(v.weightKg) : null,
        heightCm: v.heightCm ? Number(v.heightCm) : null,
        widthCm: v.widthCm ? Number(v.widthCm) : null,
        lengthCm: v.lengthCm ? Number(v.lengthCm) : null,
      })),
      images: images.filter((img) => img.url).map((img, idx) => ({ url: img.url, order: idx })),
    };

    setSaving(true);
    try {
      if (isEditing) {
        await api.put(`/admin/products/${id}`, payload);
      } else {
        await api.post('/admin/products', payload);
      }
      navigate('/produtos');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o produto.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingBlock label="Carregando produto" />;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">{isEditing ? 'Editar produto' : 'Novo produto'}</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-8">
        <section className="rounded-lg border border-line bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Dados básicos</h2>
          <div className="mt-4 space-y-4">
            <Field label="Nome">
              <input
                required className={inputClass} value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({ ...f, name, slug: isEditing ? f.slug : slugify(name) }));
                }}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Slug (URL)" hint="Gerado automaticamente, mas pode editar">
                <input required className={inputClass} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
              </Field>
              <Field label="Categoria">
                <select required className={inputClass} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                  <option value="">Selecione...</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Descrição">
              <textarea rows={3} className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tecido">
                <input className={inputClass} value={form.fabric} onChange={(e) => setForm({ ...form, fabric: e.target.value })} />
              </Field>
              <Field label="Preço base (R$)">
                <input required type="number" step="0.01" min="0" className={inputClass} value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} />
              </Field>
            </div>
            <Field label="Instruções de cuidado">
              <textarea rows={2} className={inputClass} value={form.careInstructions} onChange={(e) => setForm({ ...form, careInstructions: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Visível na loja (ativo)
            </label>
            <Field label="Aparecer em destaque" hint="Onde essa peça aparece na home da loja">
              <select className={inputClass} value={form.featuredSlot} onChange={(e) => setForm({ ...form, featuredSlot: e.target.value })}>
                <option value="">Nenhum (fica só na vitrine normal)</option>
                <option value="banner">Banner principal da home</option>
                <option value="destaque">Fileira de destaques da home</option>
              </select>
            </Field>
            <Field label="Rótulo de destaque no card (opcional)" hint='Texto livre, ex.: "LANÇAMENTO" ou "BESTSELLER" — não é desconto calculado'>
              <input className={inputClass} maxLength={30} placeholder="Ex.: LANÇAMENTO" value={form.badgeLabel} onChange={(e) => setForm({ ...form, badgeLabel: e.target.value.toUpperCase() })} />
            </Field>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Variações (tamanho + cor)</h2>
            <Button type="button" variant="secondary" size="sm" onClick={() => setVariants((prev) => [...prev, emptyVariant()])}>
              + Adicionar variação
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {variants.map((v) => (
              <div key={v.tempId} className="grid grid-cols-12 gap-2 rounded-md border border-line p-3">
                <select className={`${inputClass} col-span-2`} value={v.size} onChange={(e) => updateVariant(v.tempId, { size: e.target.value })}>
                  {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <input className={`${inputClass} col-span-2`} placeholder="Cor" value={v.color} onChange={(e) => updateVariant(v.tempId, { color: e.target.value })} />
                <input className={`${inputClass} col-span-3`} placeholder="SKU" value={v.sku} onChange={(e) => updateVariant(v.tempId, { sku: e.target.value })} />
                <input type="number" min="0" className={`${inputClass} col-span-2`} placeholder="Estoque" value={v.stockQuantity} onChange={(e) => updateVariant(v.tempId, { stockQuantity: e.target.value })} />
                <input type="number" step="0.01" min="0" className={`${inputClass} col-span-2`} placeholder="Preço específico" value={v.priceOverride || ''} onChange={(e) => updateVariant(v.tempId, { priceOverride: e.target.value })} />
                <button type="button" onClick={() => removeVariant(v.tempId)} className="col-span-1 text-xs text-ink-soft hover:text-danger-bg">
                  remover
                </button>

                <div className="col-span-12 grid grid-cols-4 gap-2">
                  <input type="number" step="0.01" min="0" className={inputClass} placeholder="Peso (kg)" value={v.weightKg || ''} onChange={(e) => updateVariant(v.tempId, { weightKg: e.target.value })} />
                  <input type="number" step="0.1" min="0" className={inputClass} placeholder="Altura (cm)" value={v.heightCm || ''} onChange={(e) => updateVariant(v.tempId, { heightCm: e.target.value })} />
                  <input type="number" step="0.1" min="0" className={inputClass} placeholder="Largura (cm)" value={v.widthCm || ''} onChange={(e) => updateVariant(v.tempId, { widthCm: e.target.value })} />
                  <input type="number" step="0.1" min="0" className={inputClass} placeholder="Comprimento (cm)" value={v.lengthCm || ''} onChange={(e) => updateVariant(v.tempId, { lengthCm: e.target.value })} />
                </div>
                <p className="col-span-12 text-[11px] text-ink-soft">
                  Peso e dimensões da embalagem — usados pra calcular o frete real por CEP. Sem preencher, o sistema usa uma estimativa padrão de camiseta dobrada.
                </p>

                {!isTemp(v.tempId) && (
                  <div className="col-span-12">
                    <StockAdjuster variant={v} onAdjusted={(newQty) => updateVariant(v.tempId, { stockQuantity: newQty })} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            Removendo uma variação por aqui apenas a tira desta lista — se ela já tiver pedidos associados, prefira zerar o estoque em vez de excluir.
          </p>
        </section>

        <section className="rounded-lg border border-line bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Imagens</h2>
            <div className="flex gap-2">
              <label className="cursor-pointer">
                <span className="inline-flex items-center justify-center gap-2 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink hover:border-ink">
                  {uploadingImage ? 'Enviando...' : '📁 Enviar do computador'}
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  disabled={uploadingImage}
                  onChange={handleFileUpload}
                />
              </label>
              <Button type="button" variant="secondary" size="sm" onClick={() => setImages((prev) => [...prev, emptyImage()])}>
                + Colar URL
              </Button>
            </div>
          </div>
          {uploadError && <p className="mt-2 text-xs text-danger-bg">{uploadError}</p>}
          <p className="mt-2 text-xs text-ink-soft">
            Toda foto nova passa por um recorte manual (arrastar + zoom) antes de subir. Já tem uma foto cadastrada
            e o enquadramento ficou ruim? Clique em "recortar" ao lado dela pra ajustar sem precisar reenviar.
          </p>
          <div className="mt-4 space-y-2">
            {images.map((img) => (
              <div key={img.tempId} className="flex items-center gap-2">
                {img.url && (
                  <img src={img.url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                )}
                <input className={inputClass} placeholder="https://..." value={img.url} onChange={(e) => updateImage(img.tempId, { url: e.target.value })} />
                {img.url && (
                  <button type="button" onClick={() => setRecropTarget({ tempId: img.tempId, url: img.url })} className="shrink-0 font-mono text-xs text-ink-soft hover:text-tag">
                    recortar
                  </button>
                )}
                <button type="button" onClick={() => removeImage(img.tempId)} className="shrink-0 text-xs text-ink-soft hover:text-danger-bg">remover</button>
              </div>
            ))}
            {images.length === 0 && <p className="text-xs text-ink-soft">Nenhuma imagem cadastrada — a loja usa uma ilustração padrão nesse caso.</p>}
          </div>
        </section>

        <ErrorNotice message={error} />

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar produto'}</Button>
          <Button type="button" variant="ghost" onClick={() => navigate('/produtos')}>Cancelar</Button>
        </div>
      </form>

      {isEditing && <DangerZone productId={id} navigate={navigate} />}

      {cropImageSrc && (
        <ImageCropModal
          imageSrc={cropImageSrc}
          aspect={3 / 4}
          queuePosition={cropQueueTotal - cropQueue.length + 1}
          queueTotal={cropQueueTotal}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}

      {recropTarget && (
        <ImageCropModal
          imageSrc={recropTarget.url}
          aspect={3 / 4}
          onConfirm={handleRecropConfirm}
          onCancel={() => setRecropTarget(null)}
        />
      )}
    </div>
  );
}

function DangerZone({ productId, navigate }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    setError('');
    setDeleting(true);
    try {
      await api.delete(`/admin/products/${productId}/permanently`);
      navigate('/produtos');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Não foi possível excluir o produto agora.'
      );
      setConfirming(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mt-6 rounded-lg border-2 border-danger-bg/40 bg-danger-bg/[0.06] p-4">
      <p className="text-xs font-black uppercase tracking-wide text-danger-bg">Excluir produto definitivamente</p>
      <p className="mt-1.5 text-xs text-ink">
        Remove o produto, variações, fotos, avaliações e favoritos de vez do banco de dados — diferente de
        desativar (que só tira da loja, mantendo tudo salvo). Só funciona se este produto nunca apareceu em
        nenhum pedido; se já foi vendido, use o campo "Visível na loja" acima para desativar em vez de excluir.
      </p>

      {!confirming ? (
        <button onClick={() => setConfirming(true)} className="mt-3 rounded-md border-2 border-danger-bg px-4 py-2 font-mono text-xs font-black uppercase tracking-wide text-danger-bg hover:bg-danger-bg hover:text-white">
          Quero excluir este produto
        </button>
      ) : (
        <div className="mt-3 space-y-2.5">
          <ErrorNotice message={error} />
          <p className="text-xs font-bold text-ink">Tem certeza? Essa ação não pode ser desfeita.</p>
          <div className="flex gap-2.5">
            <button onClick={handleDelete} disabled={deleting} className="rounded-md bg-danger-bg px-4 py-2 text-[11px] font-black uppercase tracking-wide text-white hover:opacity-90 disabled:opacity-60">
              {deleting ? 'Excluindo...' : 'Sim, excluir de vez'}
            </button>
            <button onClick={() => { setConfirming(false); setError(''); }} className="rounded-md border border-line px-4 py-2 text-[11px] font-black uppercase tracking-wide text-ink-soft hover:border-ink">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
