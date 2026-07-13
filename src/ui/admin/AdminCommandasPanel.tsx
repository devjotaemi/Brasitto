import { CheckCircle2, Plus, RefreshCw, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Comanda,
  ComandaStatus,
  type ComandaItem,
} from '../../domain/comanda/Comanda';
import {
  PRODUCT_CATEGORIES,
  type Product,
  type ProductCategory,
} from '../../domain/product/Product';
import { createCustomerDependencies } from '../customer/customerDependencies';

type AddItemForm = {
  productId: string;
  quantity: string;
};

type AdminCommandasPanelProps = {
  onCommandasChanged?: () => void;
};

const {
  addComandaItemUseCase,
  cancelComandaItemUseCase,
  closeComandaUseCase,
  listCommandasUseCase,
  listProductsUseCase,
  openComandaUseCase,
} = createCustomerDependencies();

const TABLE_NUMBERS = Array.from({ length: 50 }, (_, index) => index + 1);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

const getComandaDisplayNumber = (comanda: Comanda): string =>
  comanda.comandaNumber
    ? `#${comanda.comandaNumber.toString().padStart(6, '0')}`
    : 'Sem numero';

const formatDateTime = (date?: Date): string =>
  date
    ? new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date)
    : '--';

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

  if (error.message.includes('customer name')) {
    return 'Informe o nome do cliente para abrir a mesa.';
  }

  if (error.message.includes('table number')) {
    return 'Numero da mesa invalido.';
  }

  if (error.message.includes('duplicate') || error.message.includes('open comanda')) {
    return 'Esta mesa ja possui uma comanda aberta.';
  }

  if (error.message.includes('quantity')) {
    return 'Informe uma quantidade maior que zero.';
  }

  return error.message;
};

export function AdminCommandasPanel({
  onCommandasChanged,
}: AdminCommandasPanelProps) {
  const [openCommandas, setOpenCommandas] = useState<Comanda[]>([]);
  const [closedCommandas, setClosedCommandas] = useState<Comanda[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductCategory, setSelectedProductCategory] =
    useState<ProductCategory>('Espetos');
  const [selectedTableNumber, setSelectedTableNumber] = useState<number | null>(
    null,
  );
  const [addItemForms, setAddItemForms] = useState<Record<string, AddItemForm>>(
    {},
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isOpeningTable, setIsOpeningTable] = useState(false);
  const [updatingComandaId, setUpdatingComandaId] = useState<string | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState('');

  const activeProducts = useMemo(
    () => products.filter((product) => product.active),
    [products],
  );
  const productsByCategory = useMemo(
    () =>
      PRODUCT_CATEGORIES.map((category) => ({
        category,
        products: activeProducts.filter(
          (product) => product.category === category,
        ),
      })),
    [activeProducts],
  );
  const selectedCategoryProducts = useMemo(
    () =>
      productsByCategory.find(
        ({ category }) => category === selectedProductCategory,
      )?.products ?? [],
    [productsByCategory, selectedProductCategory],
  );
  const openComandaByTable = useMemo(
    () => {
      const entries: Array<[number, Comanda]> = openCommandas.flatMap(
        (comanda) =>
          comanda.tableNumber === undefined
            ? []
            : [[comanda.tableNumber, comanda]],
      );

      return new Map(entries);
    },
    [openCommandas],
  );
  const selectedComanda =
    selectedTableNumber === null
      ? null
      : openComandaByTable.get(selectedTableNumber) ?? null;

  async function loadCommandas() {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const [nextOpenCommandas, nextClosedCommandas, nextProducts] =
        await Promise.all([
          listCommandasUseCase.execute({
            statuses: [ComandaStatus.OPEN],
          }),
          listCommandasUseCase.execute({
            statuses: [ComandaStatus.CLOSED],
          }),
          listProductsUseCase.execute(),
        ]);

      setOpenCommandas(nextOpenCommandas);
      setClosedCommandas(
        nextClosedCommandas.sort(
          (firstComanda, secondComanda) =>
            (secondComanda.closedAt?.getTime() ?? 0) -
            (firstComanda.closedAt?.getTime() ?? 0),
        ),
      );
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

  async function selectTable(tableNumber: number) {
    setErrorMessage('');
    setSelectedTableNumber(tableNumber);

    if (openComandaByTable.has(tableNumber)) {
      return;
    }

    const customerName = window.prompt(`Nome do cliente da mesa ${tableNumber}`);

    if (!customerName?.trim()) {
      return;
    }

    setIsOpeningTable(true);

    try {
      await openComandaUseCase.execute({
        id: crypto.randomUUID(),
        tableNumber,
        customerName: customerName.trim(),
        openedAt: new Date(),
      });

      await loadCommandas();
      onCommandasChanged?.();
    } catch (error) {
      setErrorMessage(
        getUserFacingErrorMessage(error, 'Nao foi possivel abrir a mesa.'),
      );
    } finally {
      setIsOpeningTable(false);
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
      productId: selectedCategoryProducts[0]?.id ?? '',
      quantity: '1',
    };
    const productId = selectedCategoryProducts.some(
      (currentProduct) => currentProduct.id === form.productId,
    )
      ? form.productId
      : selectedCategoryProducts[0]?.id ?? '';
    const product = selectedCategoryProducts.find(
      (currentProduct) => currentProduct.id === productId,
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
          productId,
          quantity: '1',
        },
      }));
      await loadCommandas();
      onCommandasChanged?.();
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
      onCommandasChanged?.();
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

    if (!window.confirm(`Fechar a comanda da mesa ${comanda.tableNumber}?`)) {
      return;
    }

    setUpdatingComandaId(comanda.id);
    setErrorMessage('');

    try {
      await closeComandaUseCase.execute(comanda.id);
      setSelectedTableNumber(null);
      await loadCommandas();
      onCommandasChanged?.();
    } catch (error) {
      setErrorMessage(
        getUserFacingErrorMessage(error, 'Nao foi possivel fechar a comanda.'),
      );
    } finally {
      setUpdatingComandaId(null);
    }
  }

  function renderComandaItems(comanda: Comanda, canCancel: boolean) {
    const activeItems = comanda.items.filter((item) => !item.canceledAt);
    const canceledItems = comanda.items.filter((item) => item.canceledAt);

    return (
      <>
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
                {canCancel ? (
                  <button
                    className="flex h-9 items-center justify-center gap-2 rounded border border-rose-300 bg-rose-50 px-3 text-sm font-semibold text-rose-800 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={updatingComandaId === comanda.id}
                    type="button"
                    onClick={() => cancelItem(comanda, item)}
                  >
                    <XCircle className="h-4 w-4" />
                    Cancelar
                  </button>
                ) : null}
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
      </>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[520px_1fr]">
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">Mesas</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Verde livre, vermelho ocupada.
            </p>
          </div>
          <button
            className="flex h-10 items-center justify-center gap-2 rounded border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400"
            type="button"
            onClick={loadCommandas}
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
        </div>

        {errorMessage ? (
          <p className="mb-4 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {errorMessage}
          </p>
        ) : null}

        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {TABLE_NUMBERS.map((tableNumber) => {
            const isOccupied = openComandaByTable.has(tableNumber);
            const isSelected = selectedTableNumber === tableNumber;

            return (
              <button
                className={`aspect-square rounded border text-sm font-semibold transition ${
                  isSelected
                    ? 'border-zinc-950 ring-2 ring-zinc-950'
                    : isOccupied
                      ? 'border-rose-700 bg-rose-600 text-white hover:bg-rose-700'
                      : 'border-emerald-700 bg-emerald-600 text-white hover:bg-emerald-700'
                } disabled:cursor-not-allowed disabled:opacity-60`}
                disabled={isOpeningTable || isLoading}
                key={tableNumber}
                type="button"
                onClick={() => selectTable(tableNumber)}
              >
                {tableNumber}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        {selectedComanda ? (
          <article className="rounded border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-zinc-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-zinc-950">
                    Mesa {selectedComanda.tableNumber}
                  </h3>
                  <span className="rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
                    {getComandaDisplayNumber(selectedComanda)}
                  </span>
                  <span className="rounded bg-rose-50 px-2 py-1 text-xs font-medium text-rose-800">
                    Ocupada
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-700">
                  Cliente: {selectedComanda.customerName ?? selectedComanda.label}
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  Aberta em {formatDateTime(selectedComanda.openedAt)}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-sm text-zinc-600">Total parcial</p>
                <p className="text-xl font-semibold text-zinc-950">
                  {formatCurrency(selectedComanda.total)}
                </p>
              </div>
            </div>

            <div className="grid gap-3 border-b border-zinc-100 py-4">
              <div
                aria-label="Categorias para lancar na comanda"
                className="grid grid-cols-3 gap-2"
                role="tablist"
              >
                {productsByCategory.map(({ category, products }) => {
                  const isSelected = selectedProductCategory === category;

                  return (
                    <button
                      key={category}
                      aria-controls={`comanda-category-panel-${category}`}
                      aria-selected={isSelected}
                      className={`flex min-h-10 items-center justify-center rounded border px-2 text-sm font-semibold transition ${
                        isSelected
                          ? 'border-rose-700 bg-rose-50 text-rose-800'
                          : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                      }`}
                      id={`comanda-category-tab-${category}`}
                      role="tab"
                      type="button"
                      onClick={() => setSelectedProductCategory(category)}
                    >
                      <span>{category}</span>
                      <span className="ml-1 text-xs font-medium opacity-70">
                        {products.length}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div
                aria-labelledby={`comanda-category-tab-${selectedProductCategory}`}
                className="grid gap-3 lg:grid-cols-[1fr_90px_auto]"
                id={`comanda-category-panel-${selectedProductCategory}`}
                role="tabpanel"
              >
                <select
                  className="h-10 rounded border border-zinc-300 px-3 text-sm text-zinc-950 outline-none transition focus:border-rose-700 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                  disabled={!selectedCategoryProducts.length}
                  value={
                    selectedComanda.id
                      ? selectedCategoryProducts.some(
                          (product) =>
                            product.id ===
                            addItemForms[selectedComanda.id as string]
                              ?.productId,
                        )
                        ? addItemForms[selectedComanda.id]?.productId
                        : selectedCategoryProducts[0]?.id ?? ''
                      : ''
                  }
                  onChange={(event) =>
                    selectedComanda.id
                      ? updateAddItemForm(
                          selectedComanda.id,
                          'productId',
                          event.target.value,
                        )
                      : undefined
                  }
                >
                  {selectedCategoryProducts.length === 0 ? (
                    <option value="">Nenhum produto nesta categoria</option>
                  ) : null}
                  {selectedCategoryProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} - {formatCurrency(product.price)}
                    </option>
                  ))}
                </select>
                <input
                  className="h-10 rounded border border-zinc-300 px-3 text-sm text-zinc-950 outline-none transition focus:border-rose-700"
                  min="1"
                  type="number"
                  value={
                    selectedComanda.id
                      ? addItemForms[selectedComanda.id]?.quantity ?? '1'
                      : '1'
                  }
                  onChange={(event) =>
                    selectedComanda.id
                      ? updateAddItemForm(
                          selectedComanda.id,
                          'quantity',
                          event.target.value,
                        )
                      : undefined
                  }
                />
                <button
                  className="flex h-10 items-center justify-center gap-2 rounded bg-rose-700 px-4 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    !selectedCategoryProducts.length ||
                    updatingComandaId === selectedComanda.id
                  }
                  type="button"
                  onClick={() => addItem(selectedComanda)}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar
                </button>
              </div>
            </div>

            {renderComandaItems(selectedComanda, true)}

            <button
              className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded border border-emerald-300 bg-emerald-50 text-sm font-semibold text-emerald-900 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={updatingComandaId === selectedComanda.id}
              type="button"
              onClick={() => closeComanda(selectedComanda)}
            >
              <CheckCircle2 className="h-4 w-4" />
              Fechar comanda
            </button>
          </article>
        ) : (
          <div className="rounded border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
            Selecione uma mesa verde para abrir comanda ou uma mesa vermelha
            para lancar itens.
          </div>
        )}

        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-zinc-950">
            Historico de comandas
          </h2>

          {!isLoading && closedCommandas.length === 0 ? (
            <div className="rounded border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
              Nenhuma comanda fechada.
            </div>
          ) : null}

          <div className="grid gap-3">
            {closedCommandas.map((comanda) => (
              <article
                className="rounded border border-zinc-200 bg-white p-4 text-sm shadow-sm"
                key={comanda.id}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-zinc-950">
                        {comanda.tableNumber
                          ? `Mesa ${comanda.tableNumber}`
                          : comanda.label}
                      </h3>
                      <span className="rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
                        {getComandaDisplayNumber(comanda)}
                      </span>
                      <span className="rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
                        Fechada
                      </span>
                    </div>
                    <p className="mt-2 text-zinc-700">
                      Cliente: {comanda.customerName ?? comanda.label}
                    </p>
                    <p className="mt-1 text-zinc-600">
                      Aberta em {formatDateTime(comanda.openedAt)}
                    </p>
                    <p className="mt-1 text-zinc-600">
                      Fechada em {formatDateTime(comanda.closedAt)}
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="text-zinc-600">Total final</p>
                    <p className="text-xl font-semibold text-zinc-950">
                      {formatCurrency(comanda.total)}
                    </p>
                  </div>
                </div>

                {renderComandaItems(comanda, false)}
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
