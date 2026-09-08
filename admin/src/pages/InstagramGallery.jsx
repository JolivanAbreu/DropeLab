import { useEffect, useState } from 'react';
import { api, ApiError, uploadFile } from '../api/client';
import Field, { inputClass } from '../components/Field';
import Button from '../components/Button';
import ImageCropModal from '../components/ImageCropModal';
import { ErrorNotice, LoadingBlock, EmptyState } from '../components/States';

const emptyForm = { imageUrl: '', postUrl: '', caption: '', displayOrder: 0 };

/**
 * Galeria curada — posts REAIS do Instagram (link verdadeiro + foto
 * verdadeira), adicionados manualmente aqui. Não sincroniza automaticamente
 * com o Instagram (isso exigiria integração com a Graph API do Meta, conta
 * Business vinculada e renovação periódica de token — ver README do
 * backend). É a alternativa prática: sem depender de credencial externa,
 * sem token pra expirar, e o conteúdo continua sendo real.
 */
export default function InstagramGallery() {
  const [posts, setPosts] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [cropFile, setCropFile] = useState(null);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [savingId, setSavingId] = useState(null);

  function load() {
    api.get('/admin/instagram-posts').then(setPosts);
  }
  useEffect(load, []);

  useEffect(() => {
    if (!cropFile) {
      setCropImageSrc(null);
      return;
    }
    const url = URL.createObjectURL(cropFile);
    setCropImageSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [cropFile]);

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError('');
    setCropFile(file);
  }

  async function handleCropConfirm(croppedFile) {
    setCropFile(null);
    setUploadError('');
    try {
      const result = await uploadFile('/admin/uploads', croppedFile);
      setForm((prev) => ({ ...prev, imageUrl: result.url }));
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : 'Não foi possível enviar a imagem.');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.imageUrl) {
      setError('Escolha uma foto antes de adicionar.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/admin/instagram-posts', { ...form, displayOrder: Number(form.displayOrder) || 0 });
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível adicionar o post.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(post) {
    setSavingId(post.id);
    try {
      await api.put(`/admin/instagram-posts/${post.id}`, { active: !post.active });
      load();
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(post) {
    setSavingId(post.id);
    try {
      await api.delete(`/admin/instagram-posts/${post.id}`);
      load();
    } finally {
      setSavingId(null);
    }
  }

  if (posts === null) return <LoadingBlock label="Carregando galeria" />;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Galeria do Instagram</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-soft">
        Cole aqui posts reais do seu Instagram (link do post + foto) pra aparecerem na vitrine da loja.
        Isso não sincroniza automaticamente com o perfil — é você quem escolhe e atualiza quando quiser.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-line bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Adicionar post</p>

          <Field label="Foto do post">
            {form.imageUrl ? (
              <div className="flex items-center gap-3">
                <img src={form.imageUrl} alt="" className="h-16 w-16 rounded object-cover" />
                <button type="button" onClick={() => setForm({ ...form, imageUrl: '' })} className="text-xs text-ink-soft underline decoration-dotted hover:text-danger-bg">
                  trocar foto
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-line bg-canvas px-4 py-6 text-center text-xs font-bold uppercase text-ink-soft hover:border-ink">
                Escolher imagem
                <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
              </label>
            )}
            {uploadError && <p className="mt-1 text-xs text-danger-bg">{uploadError}</p>}
          </Field>

          <Field label="Link do post no Instagram" hint="Cole a URL real, ex.: https://www.instagram.com/p/ABC123/">
            <input required type="url" className={inputClass} value={form.postUrl} onChange={(e) => setForm({ ...form, postUrl: e.target.value })} placeholder="https://www.instagram.com/p/..." />
          </Field>

          <Field label="Legenda curta (opcional)">
            <input className={inputClass} maxLength={200} value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} placeholder="Ex.: Novo drop chegando" />
          </Field>

          <Field label="Ordem de exibição" hint="Menor número aparece primeiro">
            <input type="number" className={inputClass} value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: e.target.value })} />
          </Field>

          <ErrorNotice message={error} />
          <Button type="submit" disabled={saving}>{saving ? 'Adicionando...' : 'Adicionar à vitrine'}</Button>
        </form>

        <div>
          {posts.length === 0 ? (
            <EmptyState title="Nenhum post adicionado ainda" description="Adicione o primeiro post real do seu Instagram ao lado." />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {posts.map((post) => (
                <div key={post.id} className={`overflow-hidden rounded-lg border bg-white ${post.active ? 'border-line' : 'border-line opacity-50'}`}>
                  <img src={post.imageUrl} alt="" className="aspect-square w-full object-cover" />
                  <div className="p-2.5">
                    {post.caption && <p className="truncate text-xs font-medium">{post.caption}</p>}
                    <a href={post.postUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 block truncate text-[11px] text-ink-soft hover:text-tag">
                      {post.postUrl}
                    </a>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => toggleActive(post)} disabled={savingId === post.id} className="text-[11px] text-ink-soft underline decoration-dotted hover:text-tag">
                        {post.active ? 'ocultar' : 'reativar'}
                      </button>
                      <button onClick={() => handleDelete(post)} disabled={savingId === post.id} className="text-[11px] text-ink-soft underline decoration-dotted hover:text-danger-bg">
                        excluir
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {cropImageSrc && (
        <ImageCropModal
          imageSrc={cropImageSrc}
          aspect={1}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropFile(null)}
        />
      )}
    </div>
  );
}
