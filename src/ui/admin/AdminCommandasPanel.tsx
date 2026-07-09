import { Plus, RefreshCw, ReceiptText, XCircle, CheckCircle2 } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import {
  Comanda,
  ComandaStatus,
  type ComandaItem,
} from '../../domain/comanda/Comanda';
import type { Product } from '../../domain/product/Product';
import { createCustomerDependencies } from '../customer/customerDependencies';

type AddItemForm = {
  productId: string;
  quantity: string;
};

const {
  addComandaItemUseCase,
  cancelComandaItemUseCase,
  closeComandaUseCase,
  listCommandasUseCase,
  listProductsUseCase,
  openComandaUseCase,
} = createCustomerDependencies();

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

const getComandaDisplayNumber = (comanda: Comanda): string =>
  comanda.comandaNumber
    ? `#${comanda.comandaNumber.toString().padStart(6, '0')}`
    : 'Sem numero';

const getUserFacingErrorMessage = (
  error: unknown,
  fallbackMessage: string,
): string => {
  if (!(error instanceof Error)) {
    return fallbackMessage;
  }

  if (
    error.message.includes('permission') ||
    error.message.includes('row-level security') ||
    error.message.includes('401') ||
    error.message.includes('403')
  ) {
    return 'Seu acesso administrativo expirou ou nao tem permissao para esta acao. Saia e entre novamente.';
  }

  if (error.message.includes('Failed to fetch')) {
    return 'Nao foi possivel conectar ao Supabase. Verifique sua conexao e tente novamente.';
  }

  if (error.message.includes('label')) {
    return 'Informe mesa, nome ou identificacao da comanda.';
  }

  if (error.message.includes('quantity')) {
    return 'Informe uma quantidade maior que zero.';
  }

  return error.message;
};

export function AdminCommandasPanel() {
  const [commandas, setCommandas] = useState<Comanda[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [addItemForms, setAddItemForms] = useState<Record<string, AddItemForm>>(
    {},
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [updatingComandaId, setUpdatingComandaId] = useState<string | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState('');

  const activeProducts = products.filter((product) => product.active);

  async function loadCommandas() {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const [nextCommandas, nextProducts] = await Promise.all([
        listCommandasUseCase.execute({
          statuses: [ComandaStatus.OPEN],
        }),
        listProductsUseCase.execute(),
      ]);

      setCommandas(nextCommandas);
      setProducts(nextProducts);
    } catch (error) {
      setErrorMessage(
        getUserFacingErrorMessage(error, 'Nao foi possivel carregar comandas.'),
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadCommandas();
  }, []);

  async function submitComanda(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage('');

    try {
      await openComandaUseCase.execute({
        id: crypto.randomUUID(),
        label,
        notes: notes.trim() || undefined,
        openedAt: new Date(),
      });

      setLabel('');
      setNotes('');
      await loadCommandas();
    } catch (error) {
      setErrorMessage(
        getUserFacingErrorMessage(error, 'Nao foi possivel abrir a comanda.'),
      );
    } finally {
      setIsSaving(false);
    }
  }

  function updateAddItemForm(
    comandaId: string,
    field: keyof AddItemForm,
    value: string,
  ) {
    setErrorMessage('');
    setAddItemForms((currentForms) => ({
      ...currentForms,
      [comandaId]: {
        productId: currentForms[comandaId]?.productId ?? '',
        quantity: currentForms[comandaId]?.quantity ?? '1',
        [field]: value,
      },
    }));
  }

  async function addItem(comanda: Comanda) {
    if (!comanda.id) {
      return;
    }

    const form = addItemForms[comanda.id] ?? {
      productId: activeProducts[0]?.id ?? '',
      quantity: '1',
    };
    const product = activeProducts.find(
      (currentProduct) => currentProduct.id === form.productId,
    );
    const quantity = Number(form.quantity);

    if (!product) {
      setErrorMessage('Selecione um produto ativo.');
      return;
    }

    setUpdatingComandaId(comanda.id);
    setErrorMessage('');

    try {
      await addComandaItemUseCase.execute({
        comandaId: comanda.id,
        product,
        quantity,
      });

      setAddItemForms((currentForms) => ({
        ...currentForms,
        [comanda.id as string]: {
          productId: form.productId,
          quantity: '1',
        },
      }));
      await loadCommandas();
    } catch (error) {
      setErrorMessage(
        getUserFacingErrorMessage(error, 'Nao foi possivel adicionar o item.'),
      );
    } finally {
      setUpdatingComandaId(null);
    }
  }

  async function cancelItem(comanda: Comanda, item: ComandaItem) {
    if (!comanda.id || !item.id || item.canceledAt) {
      return;
    }

    if (!window.confirm(`Cancelar ${item.product.name} desta comanda?`)) {
      return;
    }

    setUpdatingComandaId(comanda.id);
    setErrorMessage('');

    try {
      await cancelComandaItemUseCase.execute({
        comandaId: comanda.id,
        itemId: item.id,
      });

      await loadCommandas();
    } catch (error) {
      setErrorMessage(
        getUserFacingErrorMessage(error, 'Nao foi possivel cancelar o item.'),
      );
    } finally {
      setUpdatingComandaId(null);
    }
  }

  async function closeComanda(comanda: Comanda) {
    if (!comanda.id) {
      return;
    }

    if (!window.confirm(`Fechar a comanda ${comanda.label}?`)) {
      return;
    }

    setUpdatingComandaId(comanda.id);
    setErrorMessage('');

    try {
      await closeComandaUseCase.execute(comanda.id);
      await loadCommandas();
    } catch (error) {
      setErrorMessage(
        getUserFacingErrorMessage(error, 'Nao foi possivel fechar a comanda.'),
      );
    } finally {
      setUpdatingComandaId(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <form
        className="h-fit rounded border border-zinc-200 bg-white p-4 shadow-sm"
        onSubmit={submitComanda}
      >
        <div className="mb-4 flex items-center gap-2">
          <ReceiptText className="h-5 w-5 text-rose-700" />
          <h2 className="text-lg font-semibold text-zinc-950">
            Nova comanda
          </h2>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1 text-sm font-medium text-zinc-700">
            Mesa, nome ou identificacao
            <input
              className="h-10 rounded border border-zinc-300 px-3 text-sm text-zinc-950 outline-none transition focus:border-rose-700"
              placeholder="Mesa 4"
              required
              value={label}
              onChange={(event) => {
                setErrorMessage('');
                setLabel(event.target.value);
              }}
            />
          </label>

          <label className="grid gap-1 text-sm font-medium text-zinc-700">
            Observacoes
            <textarea
              className="min-h-24 rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-rose-700"
              value={notes}
              onChange={(event) => {
                setErrorMessage('');
                setNotes(event.target.value);
              }}
            />
          </label>
        </div>

        {errorMessage ? (
          <p className="mt-4 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {errorMessage}
          </p>
        ) : null}

        <button
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded bg-rose-700 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSaving}
          type="submit"
        >
          <Plus className="h-4 w-4" />
          {isSaving ? 'Abrindo...' : 'Abrir comanda'}
        </button>
      </form>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-950">
            Comandas abertas
          </h2>
          <button
            className="flex h-10 items-center justify-center gap-2 rounded border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400"
            type="button"
            onClick={loadCommandas}
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
        </div>

        {isLoading ? (
          <div className="rounded border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
            Carregando comandas...
          </div>
        ) : null}

        {!isLoading && commandas.length === 0 ? (
          <div className="rounded border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
            Nenhuma comanda aberta.
          </div>
        ) : null}

        <div className="grid gap-4">
          {commandas.map((comanda) => {
            const addItemForm = comanda.id
              ? addItemForms[comanda.id] ?? {
                  productId: activeProducts[0]?.id ?? '',
                  quantity: '1',
                }
              : { productId: '', quantity: '1' };
            const activeItems = comanda.items.filter((item) => !item.canceledAt);
            const canceledItems = comanda.items.filter(
              (item) => item.canceledAt,
            );

            return (
              <article
                className="rounded border border-zinc-200 bg-white p-4 shadow-sm"
                key={comanda.id}
              >
                <div className="flex flex-col gap-3 border-b border-zinc-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-zinc-950">
                        {comanda.label}
                      </h3>
                      <span className="rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
                        {getComandaDisplayNumber(comanda)}
                      </span>
                      <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
                        Aberta
                      </span>
                    </div>
                    {comanda.notes ? (
                      <p className="mt-2 rounded border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
                        Observacao: {comanda.notes}
                      </p>
                    ) : null}
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="text-sm text-zinc-600">Total parcial</p>
                    <p className="text-xl font-semibold text-zinc-950">
                      {formatCurrency(comanda.total)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 border-b border-zinc-100 py-4 lg:grid-cols-[1fr_90px_auto]">
                  <select
                    className="h-10 rounded border border-zinc-300 px-3 text-sm text-zinc-950 outline-none transition focus:border-rose-700"
                    value={addItemForm.productId}
                    onChange={(event) =>
                      comanda.id
                        ? updateAddItemForm(
                            comanda.id,
                            'productId',
                            event.target.value,
                          )
                        : undefined
                    }
                  >
                    {activeProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} - {formatCurrency(product.price)}
                      </option>
                    ))}
                  </select>
                  <input
                    className="h-10 rounded border border-zinc-300 px-3 text-sm text-zinc-950 outline-none transition focus:border-rose-700"
                    min="1"
                    type="number"
                    value={addItemForm.quantity}
                    onChange={(event) =>
                      comanda.id
                        ? updateAddItemForm(
                            comanda.id,
                            'quantity',
                            event.target.value,
                          )
                        : undefined
                    }
                  />
                  <button
                    className="flex h-10 items-center justify-center gap-2 rounded bg-rose-700 px-4 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      !activeProducts.length ||
                      updatingComandaId === comanda.id
                    }
                    type="button"
                    onClick={() => addItem(comanda)}
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar
                  </button>
                </div>

                {activeItems.length === 0 ? (
                  <p className="py-4 text-sm text-zinc-600">
                    Nenhum item ativo nesta comanda.
                  </p>
                ) : (
                  <div className="divide-y divide-zinc-100">
                    {activeItems.map((item) => (
                      <div
                        className="grid gap-3 py-3 sm:grid-cols-[1fr_auto_auto]"
                        key={item.id}
                      >
                        <div>
                          <p className="text-sm font-semibold text-zinc-950">
                            {item.product.name}
                          </p>
                          <p className="mt-1 text-sm text-zinc-600">
                            {item.quantity} x {formatCurrency(item.unitPrice)}
                          </p>
                        </div>
                        <strong className="text-sm font-semibold text-zinc-950">
                          {formatCurrency(item.totalPrice)}
                        </strong>
                        <button
                          className="flex h-9 items-center justify-center gap-2 rounded border border-rose-300 bg-rose-50 px-3 text-sm font-semibold text-rose-800 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={updatingComandaId === comanda.id}
                          type="button"
                          onClick={() => cancelItem(comanda, item)}
                        >
                          <XCircle className="h-4 w-4" />
                          Cancelar
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {canceledItems.length > 0 ? (
                  <details className="mt-3 rounded border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
                    <summary className="cursor-pointer font-semibold text-zinc-800">
                      {canceledItems.length} itens cancelados
                    </summary>
                    <div className="mt-2 divide-y divide-zinc-200">
                      {canceledItems.map((item) => (
                        <div
                          className="flex items-center justify-between gap-3 py-2"
                          key={item.id}
                        >
                          <span>
                            {item.quantity} x {item.product.name}
                          </span>
                          <span>{formatCurrency(item.totalPrice)}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}

                <button
                  className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded border border-emerald-300 bg-emerald-50 text-sm font-semibold text-emerald-900 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={updatingComandaId === comanda.id}
                  type="button"
                  onClick={() => closeComanda(comanda)}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Fechar comanda
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
