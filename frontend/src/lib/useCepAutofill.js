import { useState, useCallback } from 'react';
import { lookupCep } from './viacep';
import { unmask } from './masks';

// Busca no ViaCEP ao completar 8 dígitos; não sobrescreve se o CEP não for encontrado.
export function useCepAutofill(setForm) {
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepNotFound, setCepNotFound] = useState(false);

  const handleCepChange = useCallback(async (maskedValue) => {
    setForm((prev) => ({ ...prev, zip: maskedValue }));
    setCepNotFound(false);

    if (unmask(maskedValue).length !== 8) return;

    setLoadingCep(true);
    const address = await lookupCep(maskedValue);
    setLoadingCep(false);

    if (!address) {
      setCepNotFound(true);
      return;
    }

    setForm((prev) => ({
      ...prev,
      street: address.street || prev.street,
      neighborhood: address.neighborhood || prev.neighborhood,
      city: address.city || prev.city,
      state: address.state || prev.state,
      complement: prev.complement || address.complement,
    }));
  }, [setForm]);

  return { handleCepChange, loadingCep, cepNotFound };
}
