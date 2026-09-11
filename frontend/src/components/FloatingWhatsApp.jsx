import { useEffect, useState } from 'react';
import { getStoreInfo, buildGeneralWhatsAppLink } from '../lib/whatsapp';

function WhatsAppIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.6 6.32A7.85 7.85 0 0 0 12.05 4a7.94 7.94 0 0 0-6.9 11.9L4 20l4.2-1.1a7.9 7.9 0 0 0 3.8 1h.01a7.94 7.94 0 0 0 5.6-13.58zm-5.55 12.2h-.01a6.6 6.6 0 0 1-3.36-.92l-.24-.14-2.5.65.67-2.44-.16-.25a6.6 6.6 0 0 1 10.4-8.1 6.55 6.55 0 0 1 1.94 4.66 6.6 6.6 0 0 1-6.74 6.54zm3.62-4.94c-.2-.1-1.17-.58-1.35-.64-.18-.07-.32-.1-.45.1-.13.19-.51.64-.63.78-.12.13-.23.15-.43.05-.2-.1-.83-.31-1.58-.98a5.9 5.9 0 0 1-1.09-1.36c-.11-.2-.01-.3.09-.4.09-.09.2-.23.3-.35.1-.11.13-.19.2-.32.06-.13.03-.24-.02-.34-.05-.1-.45-1.08-.62-1.48-.16-.39-.33-.33-.45-.34h-.39c-.13 0-.34.05-.52.24-.18.19-.68.66-.68 1.62 0 .95.7 1.87.79 2 .1.13 1.38 2.1 3.34 2.95.47.2.83.32 1.12.41.47.15.9.13 1.24.08.38-.06 1.17-.48 1.33-.94.17-.46.17-.85.12-.94-.05-.09-.18-.14-.38-.24z" />
    </svg>
  );
}

// Some automaticamente se STORE_WHATSAPP_NUMBER não estiver configurado.
export default function FloatingWhatsApp() {
  const [whatsappNumber, setWhatsappNumber] = useState(null);

  useEffect(() => {
    getStoreInfo().then((info) => setWhatsappNumber(info.whatsappNumber)).catch(() => {});
  }, []);

  if (!whatsappNumber) return null;

  return (
    <a
      href={buildGeneralWhatsAppLink(whatsappNumber)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      title="Falar no WhatsApp"
      className="fixed bottom-5 right-5 z-[220] flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_4px_14px_rgba(0,0,0,0.3)] transition-transform hover:scale-110"
    >
      <WhatsAppIcon />
    </a>
  );
}
