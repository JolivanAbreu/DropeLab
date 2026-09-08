import { useEffect, useState } from 'react';
import { api, ApiError, uploadFile } from '../api/client';
import Field, { inputClass } from '../components/Field';
import Button from '../components/Button';
import ImageCropModal from '../components/ImageCropModal';
import { ErrorNotice, LoadingBlock } from '../components/States';

const emptyForm = { eyebrow: '', title: '', subtitle: '', description: '', imageUrl: '' };

export default function PromoBannerSettings() {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [cropFile, setCropFile] = useState(null);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [recropping, setRecropping] = useState(false); // true = reajustando a imagem JÁ salva

  useEffect(() => {
    if (!cropFile) {
      setCropImageSrc(null);
      return;
    }
    const url = URL.createObjectURL(cropFile);
    setCropImageSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [cropFile]);

  useEffect(() => {
    api.get('/admin/promo-banner')
      .then((data) => setForm({
        eyebrow: data.eyebrow || '', title: data.title || '', subtitle: data.subtitle || '',
        description: data.description || '', imageUrl: data.imageUrl || '',
      }))
      .finally(() => setLoading(false));
  }, []);

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError('');
    setRecropping(false);
    setCropFile(file); // abre o recorte antes de subir — o corte fica de verdade na imagem
  }

  async function handleCropConfirm(croppedFile) {
    setCropFile(null);
    setUploadError('');
    setUploadingImage(true);
    try {
      const result = await uploadFile('/admin/uploads', croppedFile);
      setForm((prev) => ({ ...prev, imageUrl: result.url }));
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : 'Não foi possível enviar a imagem.');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.put('/admin/promo-banner', form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o banner.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingBlock label="Carregando banner" />;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">Banner promocional</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Aparece no topo da loja, acima dos produtos. Some as vezes que quiser trocar a promoção.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-line bg-white p-6">
          <Field label="Chamada pequena (linha de cima)" hint='Ex.: "compre 3"'>
            <input className={inputClass} value={form.eyebrow} onChange={(e) => setForm({ ...form, eyebrow: e.target.value })} placeholder="compre 3" />
          </Field>
          <Field label="Título grande" hint='Ex.: "camisetas"'>
            <input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="camisetas" />
          </Field>
          <Field label="Linha de baixo" hint='Ex.: "e escolha o brinde"'>
            <input className={inputClass} value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="e escolha o brinde" />
          </Field>
          <Field label="Texto de apoio (opcional)">
            <textarea rows={3} className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Escolha entre uma shoulder bag, um shorts, camiseta ou boné." />
          </Field>

          <Field label="Imagem de fundo">
            <label className="flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-line bg-canvas px-4 py-6 text-center text-xs font-bold uppercase text-ink-soft hover:border-ink">
              {uploadingImage ? 'Enviando...' : form.imageUrl ? 'Trocar imagem' : 'Escolher imagem'}
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={uploadingImage} />
            </label>
            {form.imageUrl && (
              <button
                type="button"
                onClick={() => setRecropping(true)}
                className="mt-2 font-mono text-xs text-ink-soft underline decoration-dotted hover:text-tag"
              >
                ajustar o enquadramento desta imagem
              </button>
            )}
            {uploadError && <p className="mt-1 text-xs text-danger-bg">{uploadError}</p>}
          </Field>

          <ErrorNotice message={error} />
          {saved && <p className="text-xs font-bold text-tag">Banner salvo — já está no ar ✓</p>}
          <Button type="submit" disabled={saving || uploadingImage}>{saving ? 'Salvando...' : 'Salvar banner'}</Button>
        </form>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Pré-visualização</p>
          <div
            className="relative overflow-hidden rounded-lg bg-cover bg-center"
            style={{ backgroundImage: form.imageUrl ? `url(${form.imageUrl})` : 'linear-gradient(135deg, #1f2125, #2b2e34)' }}
          >
            <div className="flex flex-col gap-3 bg-[rgba(18,20,24,0.75)] px-6 py-8 text-white">
              <div>
                <p className="text-xl font-black uppercase leading-none">{form.eyebrow || 'chamada'}</p>
                <p className="font-display mt-1 text-4xl font-black uppercase leading-[0.9] text-[#f7eedd]">{form.title || 'título'}</p>
                <p className="mt-1 text-base font-black uppercase">{form.subtitle || 'subtítulo'}</p>
              </div>
              {form.description && <p className="max-w-[240px] font-mono text-[11px] text-white/85">{form.description}</p>}
            </div>
          </div>
        </div>
      </div>

      {cropImageSrc && (
        <ImageCropModal
          imageSrc={cropImageSrc}
          aspect={2.4}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropFile(null)}
        />
      )}

      {recropping && form.imageUrl && (
        <ImageCropModal
          imageSrc={form.imageUrl}
          aspect={2.4}
          onConfirm={async (croppedFile) => {
            setRecropping(false);
            await handleCropConfirm(croppedFile);
          }}
          onCancel={() => setRecropping(false)}
        />
      )}
    </div>
  );
}
