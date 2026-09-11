import { useCallback, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { getCroppedImageBlob } from '../lib/cropImage';
import Button from './Button';

/**
 * Modal de recorte — abre com a foto recém-selecionada, o admin arrasta e
 * dá zoom até enquadrar do jeito que quer, dentro da proporção alvo (3:4
 * pra foto de produto, mais larga pra banner). Ao confirmar, devolve um
 * arquivo já recortado (Blob), pronto pra subir pro mesmo endpoint de
 * upload de sempre — o corte é de verdade, não é só um efeito visual.
 */
export default function ImageCropModal({ imageSrc, aspect = 3 / 4, onCancel, onConfirm, queuePosition, queueTotal }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [saving, setSaving] = useState(false);
  // Guarda síncrona contra clique duplo: o estado "saving" só desabilita o
  // botão no PRÓXIMO render do React, então dois cliques bem rápidos (comum
  // enquanto a pessoa espera algum retorno visual aparecer) conseguiam
  // disparar handleConfirm duas vezes antes do disabled=true realmente
  // travar o botão — resultando em duas imagens enviadas pra uma única
  // confirmação. Uma ref muda instantaneamente, sem esperar re-render.
  const confirmingRef = useRef(false);

  const onCropComplete = useCallback((_croppedArea, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleConfirm() {
    if (!croppedAreaPixels || confirmingRef.current) return;
    confirmingRef.current = true;
    setSaving(true);
    try {
      const file = await getCroppedImageBlob(imageSrc, croppedAreaPixels);
      onConfirm(file);
    } finally {
      setSaving(false);
      confirmingRef.current = false;
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4" onClick={onCancel}>
      <div className="w-full max-w-xl rounded-lg bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold text-ink">
          Ajuste o enquadramento{queueTotal > 1 ? ` (${queuePosition} de ${queueTotal})` : ''}
        </p>
        <p className="mt-0.5 text-xs text-ink-soft">Arraste pra reposicionar, use o controle abaixo pra dar zoom.</p>

        <div className="relative mt-4 h-80 w-full overflow-hidden rounded-md bg-canvas-alt">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs text-ink-soft">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-tag"
          />
        </div>

        <div className="mt-5 flex gap-3">
          <Button type="button" onClick={handleConfirm} disabled={saving || !croppedAreaPixels}>
            {saving ? 'Recortando...' : 'Usar essa imagem'}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            {queueTotal > 1 ? 'Pular esta imagem' : 'Cancelar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
