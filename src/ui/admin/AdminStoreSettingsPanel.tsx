import { Plus, Save, Settings, Trash2 } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { createCustomerDependencies } from '../customer/customerDependencies';

const {
  getStoreSettingsUseCase,
  setDeliverySettingsUseCase,
  setStoreSettingsUseCase,
} = createCustomerDependencies();

type RegionRow = {
  name: string;
  fee: string;
};

const TAQUARITINGA_REGION_SEED = [
  'Centro',
  'Vila Rosa',
  'Santa Cruz',
  'Vila Nova',
  'Jardim das Paineiras',
  'Jardim Santa Clara',
  'Jardim Sao Paulo',
  'Jardim Mazaia',
  'Jardim Dallas',
  'Jardim Maria Luiza I',
  'Conj. Hab. Rosa Bedran',
  'Santo Antonio',
  'Jardim Paraiso I',
  'Jardim Paraiso II',
  'Jardim Contendas',
  'Residencial Alto da Serra',
  'Nova Prudente',
  'Parque Residencial Laranjeiras',
  'Vila Buscardi',
  'Jardim Sao Sebastiao',
  'Jardim Vale do Sol',
  'Parque Residencial Rincao Novo',
  'Jardim dos Ipes',
];

const seedRegionRows = (): RegionRow[] =>
  TAQUARITINGA_REGION_SEED.map((name) => ({ name, fee: '0' }));

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

  if (error.message.includes('Delivery region')) {
    return 'Informe um nome e uma taxa (>= 0) para cada bairro.';
  }

  if (error.message.includes('Delivery fee')) {
    return 'Informe uma taxa de entrega igual ou maior que zero.';
  }

  return error.message;
};

type AdminStoreSettingsPanelProps = {
  canManageStoreAvailability?: boolean;
};

export function AdminStoreSettingsPanel({
  canManageStoreAvailability = false,
}: AdminStoreSettingsPanelProps) {
  const [storeOpen, setStoreOpen] = useState(true);
  const [deliveryFee, setDeliveryFee] = useState('8');
  const [regionRows, setRegionRows] = useState<RegionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  function clearFeedback() {
    setMessage('');
    setErrorMessage('');
  }

  async function loadSettings() {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const settings = await getStoreSettingsUseCase.execute();
      setStoreOpen(settings.storeOpen);
      setDeliveryFee(String(settings.deliveryFee));
      setRegionRows(
        settings.deliveryRegions.length > 0
          ? settings.deliveryRegions.map((region) => ({
              name: region.name,
              fee: String(region.fee),
            }))
          : seedRegionRows(),
      );
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

  function updateRegion(index: number, field: keyof RegionRow, value: string) {
    clearFeedback();
    setRegionRows((currentRows) =>
      currentRows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    );
  }

  function addRegion() {
    clearFeedback();
    setRegionRows((currentRows) => [...currentRows, { name: '', fee: '0' }]);
  }

  function removeRegion(index: number) {
    clearFeedback();
    setRegionRows((currentRows) =>
      currentRows.filter((_, rowIndex) => rowIndex !== index),
    );
  }

  async function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const deliveryRegions = regionRows
      .map((row) => ({
        name: row.name.trim(),
        fee: Number(row.fee.replace(',', '.')),
      }))
      .filter((region) => region.name !== '');

    try {
      const settings = canManageStoreAvailability
        ? await setStoreSettingsUseCase.execute({
            storeOpen,
            deliveryFee: Number(deliveryFee.replace(',', '.')),
            deliveryRegions,
          })
        : await setDeliverySettingsUseCase.execute({
            deliveryFee: Number(deliveryFee.replace(',', '.')),
            deliveryRegions,
          });

      setStoreOpen(settings.storeOpen);
      setDeliveryFee(String(settings.deliveryFee));
      setRegionRows(
        settings.deliveryRegions.length > 0
          ? settings.deliveryRegions.map((region) => ({
              name: region.name,
              fee: String(region.fee),
            }))
          : [],
      );
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
      className="grid max-w-2xl gap-4 rounded border border-zinc-200 bg-white p-4 shadow-sm"
      onSubmit={submitSettings}
    >
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-rose-700" />
        <h2 className="text-lg font-semibold text-zinc-950">
          {canManageStoreAvailability
            ? 'Configuracoes da loja'
            : 'Configuracoes do frete'}
        </h2>
      </div>

      {isLoading ? (
        <p className="rounded border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
          Carregando configuracoes...
        </p>
      ) : null}

      {canManageStoreAvailability ? (
        <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
          <input
            checked={storeOpen}
            className="h-4 w-4 accent-rose-700"
            type="checkbox"
            onChange={(event) => {
              setStoreOpen(event.target.checked);
              clearFeedback();
            }}
          />
          Loja aberta para pedidos
        </label>
      ) : null}

      <label className="grid gap-1 text-sm font-medium text-zinc-700">
        Taxa padrao de entrega
        <input
          className="h-10 rounded border border-zinc-300 px-3 text-sm text-zinc-950 outline-none transition focus:border-rose-700"
          min="0"
          step="0.01"
          type="number"
          value={deliveryFee}
          onChange={(event) => {
            setDeliveryFee(event.target.value);
            clearFeedback();
          }}
        />
        <span className="text-xs font-normal text-zinc-500">
          Usada quando o bairro do cliente nao esta cadastrado abaixo.
        </span>
      </label>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-700">
            Taxa por bairro
          </span>
          <button
            className="flex h-9 items-center gap-2 rounded border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400"
            type="button"
            onClick={addRegion}
          >
            <Plus className="h-4 w-4" />
            Adicionar bairro
          </button>
        </div>

        {regionRows.length === 0 ? (
          <p className="rounded border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
            Nenhum bairro cadastrado. A taxa padrao sera usada para entregas.
          </p>
        ) : (
          <div className="grid gap-2">
            {regionRows.map((row, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_120px_auto] items-center gap-2"
              >
                <input
                  className="h-10 rounded border border-zinc-300 px-3 text-sm text-zinc-950 outline-none transition focus:border-rose-700"
                  placeholder="Bairro"
                  value={row.name}
                  onChange={(event) =>
                    updateRegion(index, 'name', event.target.value)
                  }
                />
                <input
                  className="h-10 rounded border border-zinc-300 px-3 text-sm text-zinc-950 outline-none transition focus:border-rose-700"
                  min="0"
                  step="0.01"
                  type="number"
                  placeholder="Taxa"
                  value={row.fee}
                  onChange={(event) =>
                    updateRegion(index, 'fee', event.target.value)
                  }
                />
                <button
                  aria-label={`Remover ${row.name || 'bairro'}`}
                  className="grid h-10 w-10 place-items-center rounded border border-zinc-300 bg-white text-zinc-600 transition hover:border-rose-400 hover:text-rose-700"
                  type="button"
                  onClick={() => removeRegion(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

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
        {isSaving ? 'Salvando...' : 'Salvar frete'}
      </button>
    </form>
  );
}
