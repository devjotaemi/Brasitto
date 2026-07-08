import { Save, Settings } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { createCustomerDependencies } from '../customer/customerDependencies';

const { getStoreSettingsUseCase, setStoreSettingsUseCase } =
  createCustomerDependencies();

const getUserFacingErrorMessage = (
  error: unknown,
  fallbackMessage: string,
): string => {
  if (!(error instanceof Error)) {
    return fallbackMessage;
  }

  if (
    error.message.includes('permission') ||
    error.message.includes('Only owner') ||
    error.message.includes('row-level security') ||
    error.message.includes('401') ||
    error.message.includes('403')
  ) {
    return 'Apenas o dono da aplicacao pode alterar estas configuracoes.';
  }

  if (error.message.includes('Delivery fee')) {
    return 'Informe uma taxa de entrega igual ou maior que zero.';
  }

  return error.message;
};

export function AdminStoreSettingsPanel() {
  const [storeOpen, setStoreOpen] = useState(true);
  const [deliveryFee, setDeliveryFee] = useState('8');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  async function loadSettings() {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const settings = await getStoreSettingsUseCase.execute();
      setStoreOpen(settings.storeOpen);
      setDeliveryFee(String(settings.deliveryFee));
    } catch (error) {
      setErrorMessage(
        getUserFacingErrorMessage(
          error,
          'Nao foi possivel carregar as configuracoes.',
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    try {
      const settings = await setStoreSettingsUseCase.execute({
        storeOpen,
        deliveryFee: Number(deliveryFee.replace(',', '.')),
      });

      setStoreOpen(settings.storeOpen);
      setDeliveryFee(String(settings.deliveryFee));
      setMessage('Configuracoes salvas.');
    } catch (error) {
      setErrorMessage(
        getUserFacingErrorMessage(
          error,
          'Nao foi possivel salvar as configuracoes.',
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      className="grid max-w-md gap-4 rounded border border-zinc-200 bg-white p-4 shadow-sm"
      onSubmit={submitSettings}
    >
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-rose-700" />
        <h2 className="text-lg font-semibold text-zinc-950">
          Configuracoes da loja
        </h2>
      </div>

      {isLoading ? (
        <p className="rounded border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
          Carregando configuracoes...
        </p>
      ) : null}

      <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
        <input
          checked={storeOpen}
          className="h-4 w-4 accent-rose-700"
          type="checkbox"
          onChange={(event) => {
            setStoreOpen(event.target.checked);
            setMessage('');
            setErrorMessage('');
          }}
        />
        Loja aberta para pedidos
      </label>

      <label className="grid gap-1 text-sm font-medium text-zinc-700">
        Taxa fixa de entrega
        <input
          className="h-10 rounded border border-zinc-300 px-3 text-sm text-zinc-950 outline-none transition focus:border-rose-700"
          min="0"
          step="0.01"
          type="number"
          value={deliveryFee}
          onChange={(event) => {
            setDeliveryFee(event.target.value);
            setMessage('');
            setErrorMessage('');
          }}
        />
      </label>

      {message ? (
        <p className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {message}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {errorMessage}
        </p>
      ) : null}

      <button
        className="flex h-11 items-center justify-center gap-2 rounded bg-rose-700 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isLoading || isSaving}
        type="submit"
      >
        <Save className="h-4 w-4" />
        {isSaving ? 'Salvando...' : 'Salvar configuracoes'}
      </button>
    </form>
  );
}
