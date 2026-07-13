import {
  CheckCircle2,
  ClipboardList,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShoppingBasket,
  Trash2,
  Truck,
  XCircle,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import type { CartItem } from '../../domain/cart/Cart';
import { Order, OrderStatus, OrderType } from '../../domain/order/Order';
import {
  PRODUCT_CATEGORIES,
  Product,
} from '../../domain/product/Product';
import {
  isSupabaseConfigured,
  supabaseClient,
} from '../../infrastructure/supabase/supabaseClient';
import {
  formatOrderDateTime,
  getOrderDisplayNumber,
} from '../orderPresentation';
import { useApplicationLockStatus } from '../useApplicationLockStatus';
import { createCustomerDependencies } from './customerDependencies';

type CartLine = {
  product: Product;
  quantity: number;
};

type CustomerForm = {
  name: string;
  phone: string;
  address: string;
  note: string;
};

const {
  calculateOrderTotalUseCase,
  cancelCustomerOrderUseCase,
  createOrderUseCase,
  getCustomerOrderStatusUseCase,
  getApplicationLockStatusUseCase,
  getStoreSettingsUseCase,
  listActiveProductsUseCase,
  repositoryMode,
} = createCustomerDependencies();

const ORDER_STATUS_POLL_INTERVAL_MS = 15000;
const STORE_SETTINGS_POLL_INTERVAL_MS = 60000;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

const createCartItems = (cartLines: CartLine[]): CartItem[] =>
  cartLines.map((line) => ({
    product: line.product,
    quantity: line.quantity,
    unitPrice: line.product.price,
    totalPrice: line.product.price * line.quantity,
  }));

const groupProductsByCategory = (products: Product[]) =>
  PRODUCT_CATEGORIES.map((category) => ({
    category,
    products: products.filter((product) => product.category === category),
  }));

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)})${digits.slice(2)}`;
  }

  return `(${digits.slice(0, 2)})${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const orderStatusLabel: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'Pendente',
  [OrderStatus.ACCEPTED]: 'Aceito',
  [OrderStatus.IN_PREPARATION]: 'Em preparo',
  [OrderStatus.OUT_FOR_DELIVERY]: 'Saiu para entrega',
  [OrderStatus.READY_FOR_PICKUP]: 'Pronto para retirada',
  [OrderStatus.FINISHED]: 'Finalizado',
  [OrderStatus.CANCELED]: 'Cancelado',
};

const activeOrderStatuses = new Set<OrderStatus>([
  OrderStatus.PENDING,
  OrderStatus.ACCEPTED,
  OrderStatus.IN_PREPARATION,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.READY_FOR_PICKUP,
]);

const getErrorMessage = (error: unknown): string | null => {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return null;
};

export const getCustomerUserFacingErrorMessage = (
  error: unknown,
  fallbackMessage: string,
): string => {
  const errorMessage = getErrorMessage(error);

  if (!errorMessage) {
    return fallbackMessage;
  }

  if (errorMessage.includes('Failed to fetch')) {
    return 'Nao foi possivel conectar ao sistema de pedidos. Verifique sua conexao e tente novamente.';
  }

  if (
    errorMessage.includes('row-level security') ||
    errorMessage.includes('401') ||
    errorMessage.includes('403')
  ) {
    return 'O sistema recusou esta operacao. Tente novamente em alguns instantes.';
  }

  if (errorMessage.includes('customer name and phone')) {
    return 'Informe nome e telefone para enviar o pedido.';
  }

  if (errorMessage.includes('address')) {
    return 'Informe o endereco para pedido de entrega.';
  }

  if (errorMessage.includes('at least one item')) {
    return 'Adicione pelo menos um item ao pedido.';
  }

  if (errorMessage.includes('Order number')) {
    return 'Informe um numero de pedido valido.';
  }

  if (errorMessage.includes('Customer phone')) {
    return 'Informe o telefone usado no pedido.';
  }

  if (errorMessage.includes('Store is closed')) {
    return 'A loja esta fechada no momento.';
  }

  if (errorMessage.includes('Customer already has an active order')) {
    return 'Voce ja tem um pedido realizado com este telefone. Consulte ou cancele o pedido atual antes de fazer outro.';
  }

  if (errorMessage.includes('Customer order cannot be canceled')) {
    return 'Este pedido ja esta em preparo ou saiu para entrega. Entre em contato com a loja para cancelar.';
  }

  if (errorMessage.includes('Customer order not found')) {
    return 'Nao encontramos pedido com esse numero e telefone.';
  }

  return errorMessage;
};

export function CustomerApp() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [orderType, setOrderType] = useState<OrderType>(OrderType.PICKUP);
  const [form, setForm] = useState<CustomerForm>({
    name: '',
    phone: '',
    address: '',
    note: '',
  });
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [productErrorMessage, setProductErrorMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [storeSettings, setStoreSettings] = useState({
    storeOpen: true,
    deliveryFee: 8,
  });
  const [isCheckingStoreSettings, setIsCheckingStoreSettings] = useState(true);
  const [statusOrderNumber, setStatusOrderNumber] = useState('');
  const [statusCustomerPhone, setStatusCustomerPhone] = useState('');
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);
  const [isLoadingOrderStatus, setIsLoadingOrderStatus] = useState(false);
  const [isCancelingOrder, setIsCancelingOrder] = useState(false);
  const [isOrderLookupOpen, setIsOrderLookupOpen] = useState(false);
  const [orderStatusMessage, setOrderStatusMessage] = useState('');
  const [orderStatusMessageTone, setOrderStatusMessageTone] = useState<
    'error' | 'success'
  >('error');
  const { isCheckingApplicationLock, isApplicationLocked } =
    useApplicationLockStatus(
      'customer-application-lock',
      getApplicationLockStatusUseCase,
    );

  useEffect(() => {
    if (isCheckingApplicationLock || isApplicationLocked) {
      setIsLoadingProducts(false);
      return;
    }

    let isMounted = true;

    async function loadProducts() {
      setIsLoadingProducts(true);
      setProductErrorMessage('');

      try {
        const activeProducts = await listActiveProductsUseCase.execute();

        if (isMounted) {
          setProducts(activeProducts);
        }
      } catch (error) {
        if (isMounted) {
          setProductErrorMessage(
            getCustomerUserFacingErrorMessage(
              error,
              'Nao foi possivel carregar o cardapio.',
            ),
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingProducts(false);
        }
      }
    }

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, [isApplicationLocked, isCheckingApplicationLock]);

  useEffect(() => {
    let isMounted = true;

    async function refreshIfMounted(options: { showLoading?: boolean } = {}) {
      if (!isMounted) {
        return;
      }

      if (options.showLoading) {
        setIsCheckingStoreSettings(true);
      }

      try {
        const settings = await getStoreSettingsUseCase.execute();

        if (!isMounted) {
          return;
        }

        setStoreSettings(settings);

        if (!settings.storeOpen) {
          setCreatedOrder(null);
        }
      } finally {
        if (isMounted) {
          setIsCheckingStoreSettings(false);
        }
      }
    }

    void refreshIfMounted({ showLoading: true });

    const intervalId = window.setInterval(() => {
      void refreshIfMounted();
    }, STORE_SETTINGS_POLL_INTERVAL_MS);

    if (!isSupabaseConfigured || supabaseClient === null) {
      return () => {
        isMounted = false;
        window.clearInterval(intervalId);
      };
    }

    const realtimeClient = supabaseClient;
    const channel = realtimeClient
      .channel('customer-store-settings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
          filter: 'key=eq.store_settings',
        },
        () => {
          void refreshIfMounted();
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void refreshIfMounted();
        }
      });

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      void realtimeClient.removeChannel(channel);
    };
  }, []);

  const cartItems = useMemo(() => createCartItems(cartLines), [cartLines]);

  const totals = useMemo(() => {
    if (cartItems.length === 0) {
      return {
        subtotal: 0,
        deliveryFee: 0,
        total: 0,
      };
    }

    if (orderType === OrderType.DELIVERY && form.address.trim() === '') {
      return {
        subtotal: cartItems.reduce((total, item) => total + item.totalPrice, 0),
        deliveryFee: storeSettings.deliveryFee,
        total:
          cartItems.reduce((total, item) => total + item.totalPrice, 0) +
          storeSettings.deliveryFee,
      };
    }

    return calculateOrderTotalUseCase.execute({
      type: orderType,
      address:
        orderType === OrderType.DELIVERY ? form.address.trim() : undefined,
      items: cartItems,
      deliveryFee: storeSettings.deliveryFee,
    });
  }, [cartItems, form.address, orderType, storeSettings.deliveryFee]);

  const totalItems = useMemo(
    () => cartLines.reduce((total, line) => total + line.quantity, 0),
    [cartLines],
  );
  const productsByCategory = useMemo(
    () => groupProductsByCategory(products),
    [products],
  );
  const canCancelTrackedOrder =
    trackedOrder?.status === OrderStatus.PENDING ||
    trackedOrder?.status === OrderStatus.ACCEPTED;

  function addProduct(product: Product) {
    if (!product.active) {
      return;
    }

    if (!storeSettings.storeOpen) {
      return;
    }

    setCreatedOrder(null);
    setCartLines((currentLines) => {
      const existingLine = currentLines.find(
        (line) => line.product.id === product.id,
      );

      if (!existingLine) {
        return [...currentLines, { product, quantity: 1 }];
      }

      return currentLines.map((line) =>
        line.product.id === product.id
          ? { ...line, quantity: line.quantity + 1 }
          : line,
      );
    });
  }

  function decreaseProduct(product: Product) {
    setCreatedOrder(null);
    setCartLines((currentLines) =>
      currentLines.flatMap((line) => {
        if (line.product.id !== product.id) {
          return [line];
        }

        if (line.quantity === 1) {
          return [];
        }

        return [{ ...line, quantity: line.quantity - 1 }];
      }),
    );
  }

  function removeProduct(product: Product) {
    setCreatedOrder(null);
    setCartLines((currentLines) =>
      currentLines.filter((line) => line.product.id !== product.id),
    );
  }

  function updateForm(field: keyof CustomerForm, value: string) {
    setCreatedOrder(null);
    setErrorMessage('');
    setForm((currentForm) => ({
      ...currentForm,
      [field]: field === 'phone' ? formatPhone(value) : value,
    }));
  }

  const loadCustomerOrderStatus = useCallback(
    async (options: { silent?: boolean } = {}) => {
      const orderNumber = Number(statusOrderNumber);

      if (!options.silent) {
        setIsLoadingOrderStatus(true);
        setOrderStatusMessage('');
        setOrderStatusMessageTone('error');
      }

      try {
        const order = await getCustomerOrderStatusUseCase.execute({
          orderNumber,
          customerPhone: statusCustomerPhone.trim(),
        });

        setTrackedOrder(order);

        if (!order) {
          setOrderStatusMessageTone('error');
          setOrderStatusMessage(
            'Nao encontramos pedido com esse numero e telefone.',
          );
        }
      } catch (error) {
        if (!options.silent) {
          setTrackedOrder(null);
          setOrderStatusMessageTone('error');
          setOrderStatusMessage(
            getCustomerUserFacingErrorMessage(
              error,
              'Nao foi possivel consultar o pedido.',
            ),
          );
        }
      } finally {
        if (!options.silent) {
          setIsLoadingOrderStatus(false);
        }
      }
    },
    [statusCustomerPhone, statusOrderNumber],
  );

  useEffect(() => {
    if (!trackedOrder || !activeOrderStatuses.has(trackedOrder.status)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadCustomerOrderStatus({ silent: true });
    }, ORDER_STATUS_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadCustomerOrderStatus, trackedOrder]);

  async function submitOrderStatusLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadCustomerOrderStatus();
  }

  async function cancelTrackedOrder() {
    const orderNumber = Number(statusOrderNumber);

    if (!canCancelTrackedOrder || isCancelingOrder) {
      return;
    }

    if (!window.confirm('Cancelar este pedido?')) {
      return;
    }

    setIsCancelingOrder(true);
    setOrderStatusMessage('');
    setOrderStatusMessageTone('error');

    try {
      const canceledOrder = await cancelCustomerOrderUseCase.execute({
        orderNumber,
        customerPhone: statusCustomerPhone.trim(),
      });

      setTrackedOrder(canceledOrder);
      setOrderStatusMessageTone('success');
      setOrderStatusMessage('Pedido cancelado com sucesso.');
    } catch (error) {
      setOrderStatusMessageTone('error');
      setOrderStatusMessage(
        getCustomerUserFacingErrorMessage(
          error,
          'Nao foi possivel cancelar o pedido.',
        ),
      );
    } finally {
      setIsCancelingOrder(false);
    }
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmittingOrder) {
      return;
    }

    setErrorMessage('');
    setCreatedOrder(null);
    setIsSubmittingOrder(true);

    try {
      if (!storeSettings.storeOpen) {
        throw new Error('Store is closed');
      }

      const order = await createOrderUseCase.execute({
        id: crypto.randomUUID(),
        customerName: form.name.trim(),
        customerPhone: form.phone.trim(),
        type: orderType,
        address:
          orderType === OrderType.DELIVERY ? form.address.trim() : undefined,
        customerNote: form.note.trim() || undefined,
        items: cartItems,
        deliveryFee: storeSettings.deliveryFee,
        createdAt: new Date(),
      });

      setCreatedOrder(order);
      setStatusOrderNumber(order.orderNumber?.toString() ?? '');
      setStatusCustomerPhone(form.phone);
      setTrackedOrder(order);
      setOrderStatusMessage('');
      setCartLines([]);
      setForm({
        name: '',
        phone: '',
        address: '',
        note: '',
      });
      setOrderType(OrderType.PICKUP);
    } catch (error) {
      if (
        getErrorMessage(error)?.includes('Customer already has an active order')
      ) {
        setStatusCustomerPhone(form.phone);
        setIsOrderLookupOpen(true);
      }

      setErrorMessage(
        getCustomerUserFacingErrorMessage(
          error,
          'Nao foi possivel enviar o pedido.',
        ),
      );
    } finally {
      setIsSubmittingOrder(false);
    }
  }

  function startNewOrder() {
    setCreatedOrder(null);
    setErrorMessage('');
  }

  if (isCheckingApplicationLock || isCheckingStoreSettings) {
    return (
      <main className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <div className="rounded border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
            Verificando disponibilidade...
          </div>
        </div>
      </main>
    );
  }

  if (isApplicationLocked) {
    return (
      <main className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <div className="rounded border border-rose-200 bg-rose-50 p-6 text-rose-900 shadow-sm">
            <h1 className="text-xl font-semibold text-rose-950">
              Aplicacao indisponivel
            </h1>
            <p className="mt-2 text-sm leading-6">
              Entre em contato com o administrador.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-normal text-emerald-700">
              Delivery e retirada
            </p>
            <h1 className="text-3xl font-semibold tracking-normal text-zinc-950">
              Espetaria
            </h1>
          </div>

          <div className="flex h-11 items-center gap-3 rounded border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-700">
            <ShoppingBasket className="h-5 w-5 text-rose-700" />
            <span>{totalItems} itens</span>
            <span className="h-5 w-px bg-zinc-200" />
            <strong className="font-semibold text-zinc-950">
              {formatCurrency(totals.total)}
            </strong>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_380px]">
        <section aria-labelledby="menu-title">
          {!storeSettings.storeOpen ? (
            <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
              <p className="font-semibold">Loja fechada no momento</p>
              <p className="mt-1">
                Voce ainda pode consultar um pedido ja enviado.
              </p>
            </div>
          ) : null}

          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2
                id="menu-title"
                className="text-xl font-semibold tracking-normal text-zinc-950"
              >
                Cardapio
              </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Escolha seus itens separados por categoria.
            </p>
            <p className="mt-2 text-xs font-medium text-zinc-500">
              Fonte: {repositoryMode === 'supabase' ? 'Supabase' : 'local'}
            </p>
          </div>
        </div>

          <div className="grid gap-3">
            {isLoadingProducts ? (
              <div className="rounded border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
                Carregando cardapio...
              </div>
            ) : null}

            {productErrorMessage ? (
              <div className="rounded border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                {productErrorMessage}
              </div>
            ) : null}

            {!isLoadingProducts &&
            !productErrorMessage &&
            products.length === 0 ? (
              <div className="rounded border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
                Nenhum produto ativo disponivel.
              </div>
            ) : null}

            {!isLoadingProducts && !productErrorMessage && products.length > 0
              ? productsByCategory.map(({ category, products }) => (
                  <section
                    key={category}
                    aria-labelledby={`category-${category}`}
                    className="grid gap-3"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                      <h3
                        id={`category-${category}`}
                        className="text-base font-semibold text-zinc-950"
                      >
                        {category}
                      </h3>
                      <span className="text-xs font-medium text-zinc-500">
                        {products.length} itens
                      </span>
                    </div>

                    {products.length === 0 ? (
                      <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
                        Nenhum item ativo nesta categoria.
                      </div>
                    ) : null}

                    {products.map((product) => {
                      const quantity =
                        cartLines.find(
                          (line) => line.product.id === product.id,
                        )?.quantity ?? 0;

                      return (
                        <article
                          key={product.id}
                          className="grid gap-4 rounded border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-[160px_1fr_auto]"
                        >
                          <div className="aspect-[4/3] overflow-hidden rounded bg-zinc-100">
                            {product.imageUrl ? (
                              <img
                                alt={product.name}
                                className="h-full w-full object-cover"
                                loading="lazy"
                                src={product.imageUrl}
                              />
                            ) : (
                              <div className="grid h-full place-items-center px-3 text-center text-xs font-medium text-zinc-500">
                                Sem foto
                              </div>
                            )}
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-base font-semibold text-zinc-950">
                                {product.name}
                              </h4>
                              <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
                                Disponivel
                              </span>
                            </div>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                              {product.description}
                            </p>
                            <p className="mt-3 text-base font-semibold text-zinc-950">
                              {formatCurrency(product.price)}
                            </p>
                          </div>

                          <div className="flex h-11 items-center justify-between gap-2 sm:justify-end">
                            <button
                              aria-label={`Diminuir ${product.name}`}
                              className="grid h-10 w-10 place-items-center rounded border border-zinc-300 bg-white text-zinc-700 transition hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-40"
                              disabled={quantity === 0}
                              type="button"
                              onClick={() => decreaseProduct(product)}
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="grid h-10 w-10 place-items-center text-sm font-semibold text-zinc-950">
                              {quantity}
                            </span>
                            <button
                              aria-label={`Adicionar ${product.name}`}
                              className="grid h-10 w-10 place-items-center rounded bg-rose-700 text-white transition hover:bg-rose-800"
                              disabled={!storeSettings.storeOpen}
                              type="button"
                              onClick={() => addProduct(product)}
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </section>
                ))
              : null}
          </div>
        </section>

        <aside
          aria-labelledby="cart-title"
          className="h-fit rounded border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2
              id="cart-title"
              className="text-lg font-semibold tracking-normal text-zinc-950"
            >
              Pedido
            </h2>
            <ShoppingBasket className="h-5 w-5 text-rose-700" />
          </div>

          <section className="mb-4 border-b border-zinc-100 pb-4">
            <button
              className="flex h-10 w-full items-center justify-center gap-2 rounded border border-zinc-300 bg-white text-sm font-semibold text-zinc-800 transition hover:border-zinc-400"
              type="button"
              onClick={() =>
                setIsOrderLookupOpen((currentValue) => !currentValue)
              }
            >
              <ClipboardList className="h-4 w-4" />
              {isOrderLookupOpen ? 'Fechar consulta' : 'Consultar pedido'}
            </button>

            {isOrderLookupOpen ? (
              <div className="mt-4">
                <form className="grid gap-3" onSubmit={submitOrderStatusLookup}>
                  <label className="grid gap-1 text-sm font-medium text-zinc-700">
                    Numero do pedido
                    <input
                      className="h-10 rounded border border-zinc-300 px-3 text-sm text-zinc-950 outline-none transition focus:border-rose-700"
                      inputMode="numeric"
                      min="1"
                      type="number"
                      value={statusOrderNumber}
                      onChange={(event) => {
                        setStatusOrderNumber(event.target.value);
                        setOrderStatusMessage('');
                        setOrderStatusMessageTone('error');
                      }}
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-zinc-700">
                    Telefone
                    <input
                      className="h-10 rounded border border-zinc-300 px-3 text-sm text-zinc-950 outline-none transition focus:border-rose-700"
                      value={statusCustomerPhone}
                      onChange={(event) => {
                        setStatusCustomerPhone(formatPhone(event.target.value));
                        setOrderStatusMessage('');
                        setOrderStatusMessageTone('error');
                      }}
                    />
                  </label>

                  <button
                    className="flex h-10 items-center justify-center gap-2 rounded border border-zinc-300 bg-white text-sm font-semibold text-zinc-800 transition hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isLoadingOrderStatus}
                    type="submit"
                  >
                    <Search className="h-4 w-4" />
                    {isLoadingOrderStatus ? 'Consultando...' : 'Consultar'}
                  </button>
                </form>

                {orderStatusMessage ? (
                  <p
                    className={`mt-3 rounded border p-3 text-sm ${
                      orderStatusMessageTone === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-rose-200 bg-rose-50 text-rose-800'
                    }`}
                  >
                    {orderStatusMessage}
                  </p>
                ) : null}

                {trackedOrder ? (
                  <div className="mt-3 rounded border border-zinc-200 bg-zinc-50 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-zinc-950">
                        {getOrderDisplayNumber(trackedOrder)}
                      </p>
                      <span className="rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                        {orderStatusLabel[trackedOrder.status]}
                      </span>
                    </div>
                    <p className="mt-2 text-zinc-600">
                      Recebido em {formatOrderDateTime(trackedOrder.createdAt)}
                    </p>
                    <p className="mt-1 text-zinc-600">
                      {trackedOrder.type === OrderType.DELIVERY
                        ? 'Entrega'
                        : 'Retirada'}
                    </p>
                    {trackedOrder.estimatedReadyAt ? (
                      <p className="mt-2 rounded border border-emerald-200 bg-emerald-50 p-3 text-emerald-950">
                        Previsao:{' '}
                        {formatOrderDateTime(trackedOrder.estimatedReadyAt)}
                      </p>
                    ) : null}
                    {trackedOrder.status === OrderStatus.CANCELED &&
                    trackedOrder.cancellationReason ? (
                      <p className="mt-3 rounded border border-rose-200 bg-rose-50 p-3 text-rose-900">
                        Motivo do cancelamento:{' '}
                        {trackedOrder.cancellationReason}
                      </p>
                    ) : null}
                    {canCancelTrackedOrder ? (
                      <div className="mt-3 rounded border border-rose-200 bg-white p-3">
                        <p className="text-sm text-zinc-700">
                          Se precisar, voce pode cancelar enquanto o pedido
                          ainda nao entrou em preparo.
                        </p>
                        <button
                          className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded border border-rose-300 bg-rose-50 text-sm font-semibold text-rose-800 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isCancelingOrder}
                          type="button"
                          onClick={cancelTrackedOrder}
                        >
                          <XCircle className="h-4 w-4" />
                          {isCancelingOrder
                            ? 'Cancelando...'
                            : 'Cancelar pedido'}
                        </button>
                      </div>
                    ) : null}
                    <div className="mt-3 divide-y divide-zinc-200 border-t border-zinc-200 pt-1">
                      {trackedOrder.items.map((item) => (
                        <div
                          key={`${trackedOrder.id}-${item.product.name}`}
                          className="grid grid-cols-[1fr_auto] gap-3 py-2"
                        >
                          <span className="text-zinc-700">
                            {item.quantity} x {item.product.name}
                          </span>
                          <strong className="font-semibold text-zinc-950">
                            {formatCurrency(item.totalPrice)}
                          </strong>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-zinc-200 pt-2">
                      <span className="font-semibold text-zinc-950">Total</span>
                      <strong className="font-semibold text-zinc-950">
                        {formatCurrency(trackedOrder.total)}
                      </strong>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          {createdOrder ? (
            <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded bg-emerald-100 text-emerald-800">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">Pedido enviado</p>
                  <p className="mt-1 text-emerald-900">
                    {getOrderDisplayNumber(createdOrder)} recebido em{' '}
                    {formatOrderDateTime(createdOrder.createdAt)}.
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded border border-emerald-200 bg-white p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
                  {createdOrder.type === OrderType.DELIVERY ? (
                    <Truck className="h-4 w-4 text-rose-700" />
                  ) : (
                    <PackageCheck className="h-4 w-4 text-emerald-700" />
                  )}
                  {createdOrder.type === OrderType.DELIVERY
                    ? 'Entrega'
                    : 'Retirada'}
                </div>

                <div className="mt-3 grid gap-1 text-sm text-zinc-700">
                  <p>
                    <span className="font-medium text-zinc-950">Cliente:</span>{' '}
                    {createdOrder.customerName}
                  </p>
                  <p>
                    <span className="font-medium text-zinc-950">Telefone:</span>{' '}
                    {createdOrder.customerPhone}
                  </p>
                  {createdOrder.customerNote ? (
                    <p>
                      <span className="font-medium text-zinc-950">
                        Observacao:
                      </span>{' '}
                      {createdOrder.customerNote}
                    </p>
                  ) : null}
                  {createdOrder.type === OrderType.DELIVERY ? (
                    <p>
                      <span className="font-medium text-zinc-950">
                        Endereco:
                      </span>{' '}
                      {createdOrder.address}
                    </p>
                  ) : null}
                </div>

                <div className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100 pt-1">
                  {createdOrder.items.map((item) => (
                    <div
                      key={`${createdOrder.id}-${item.product.name}`}
                      className="grid grid-cols-[1fr_auto] gap-3 py-2"
                    >
                      <div>
                        <p className="font-medium text-zinc-950">
                          {item.product.name}
                        </p>
                        <p className="mt-0.5 text-zinc-600">
                          {item.quantity} x {formatCurrency(item.unitPrice)}
                        </p>
                      </div>
                      <strong className="font-semibold text-zinc-950">
                        {formatCurrency(item.totalPrice)}
                      </strong>
                    </div>
                  ))}
                </div>

                <dl className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
                  <div className="flex items-center justify-between">
                    <dt className="text-zinc-600">Subtotal</dt>
                    <dd className="font-semibold text-zinc-950">
                      {formatCurrency(createdOrder.subtotal)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-zinc-600">Taxa de entrega</dt>
                    <dd className="font-semibold text-zinc-950">
                      {formatCurrency(createdOrder.deliveryFee)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between border-t border-zinc-100 pt-2 text-base">
                    <dt className="font-semibold text-zinc-950">Total</dt>
                    <dd className="font-semibold text-zinc-950">
                      {formatCurrency(createdOrder.total)}
                    </dd>
                  </div>
                </dl>
              </div>

              <button
                className="mt-3 h-10 w-full rounded bg-emerald-700 text-sm font-semibold text-white transition hover:bg-emerald-800"
                type="button"
                onClick={startNewOrder}
              >
                Fazer novo pedido
              </button>
            </div>
          ) : null}

          {cartLines.length === 0 ? (
            createdOrder ? null : (
              <p className="rounded border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
                {storeSettings.storeOpen
                  ? 'Seu carrinho esta vazio.'
                  : 'Pedidos indisponiveis enquanto a loja estiver fechada.'}
              </p>
            )
          ) : (
            <form className="space-y-4" onSubmit={submitOrder}>
              <div className="space-y-3">
                {cartLines.map((line) => (
                  <div
                    key={line.product.id}
                    className="grid grid-cols-[1fr_auto] gap-3 border-b border-zinc-100 pb-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-zinc-950">
                        {line.product.name}
                      </p>
                      <p className="mt-1 text-sm text-zinc-600">
                        {line.quantity} x {formatCurrency(line.product.price)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <strong className="text-sm font-semibold text-zinc-950">
                        {formatCurrency(line.product.price * line.quantity)}
                      </strong>
                      <button
                        aria-label={`Remover ${line.product.name}`}
                        className="grid h-8 w-8 place-items-center rounded border border-zinc-200 text-zinc-600 transition hover:border-rose-200 hover:text-rose-700"
                        type="button"
                        onClick={() => removeProduct(line.product)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  className={`flex h-11 items-center justify-center gap-2 rounded border text-sm font-semibold transition ${
                    orderType === OrderType.PICKUP
                      ? 'border-rose-700 bg-rose-50 text-rose-800'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                  }`}
                  type="button"
                  onClick={() => setOrderType(OrderType.PICKUP)}
                >
                  <PackageCheck className="h-4 w-4" />
                  Retirada
                </button>
                <button
                  className={`flex h-11 items-center justify-center gap-2 rounded border text-sm font-semibold transition ${
                    orderType === OrderType.DELIVERY
                      ? 'border-rose-700 bg-rose-50 text-rose-800'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                  }`}
                  type="button"
                  onClick={() => setOrderType(OrderType.DELIVERY)}
                >
                  <Truck className="h-4 w-4" />
                  Entrega
                </button>
              </div>

              <div className="grid gap-3">
                <label className="grid gap-1 text-sm font-medium text-zinc-700">
                  Nome
                  <input
                    className="h-10 rounded border border-zinc-300 px-3 text-sm text-zinc-950 outline-none transition focus:border-rose-700"
                    value={form.name}
                    onChange={(event) => updateForm('name', event.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-zinc-700">
                  Telefone
                  <input
                    className="h-10 rounded border border-zinc-300 px-3 text-sm text-zinc-950 outline-none transition focus:border-rose-700"
                    value={form.phone}
                    onChange={(event) =>
                      updateForm('phone', event.target.value)
                    }
                  />
                </label>
                {orderType === OrderType.DELIVERY ? (
                  <label className="grid gap-1 text-sm font-medium text-zinc-700">
                    Endereco
                    <input
                      className="h-10 rounded border border-zinc-300 px-3 text-sm text-zinc-950 outline-none transition focus:border-rose-700"
                      value={form.address}
                      onChange={(event) =>
                        updateForm('address', event.target.value)
                      }
                    />
                  </label>
                ) : null}
                <label className="grid gap-1 text-sm font-medium text-zinc-700">
                  Observacoes
                  <textarea
                    className="min-h-24 rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-rose-700"
                    value={form.note}
                    onChange={(event) =>
                      updateForm('note', event.target.value)
                    }
                  />
                </label>
              </div>

              <div className="space-y-2 border-t border-zinc-100 pt-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">Subtotal</span>
                  <strong className="font-semibold text-zinc-950">
                    {formatCurrency(totals.subtotal)}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">Taxa de entrega</span>
                  <strong className="font-semibold text-zinc-950">
                    {formatCurrency(totals.deliveryFee)}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-base">
                  <span className="font-semibold text-zinc-950">Total</span>
                  <strong className="font-semibold text-zinc-950">
                    {formatCurrency(totals.total)}
                  </strong>
                </div>
              </div>

              {errorMessage ? (
                <p className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  {errorMessage}
                </p>
              ) : null}

              {!storeSettings.storeOpen ? (
                <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  A loja fechou para novos pedidos.
                </p>
              ) : null}

              <button
                className="h-11 w-full rounded bg-rose-700 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!storeSettings.storeOpen || isSubmittingOrder}
                type="submit"
              >
                {isSubmittingOrder
                  ? 'Enviando...'
                  : storeSettings.storeOpen
                    ? 'Enviar pedido'
                    : 'Loja fechada'}
              </button>
            </form>
          )}
        </aside>
      </div>
    </main>
  );
}
