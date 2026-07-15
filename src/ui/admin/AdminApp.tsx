import {
  CheckCircle2,
  ClipboardList,
  DollarSign,
  Flame,
  Bell,
  LockKeyhole,
  LogOut,
  Mail,
  PackageCheck,
  Power,
  RefreshCw,
  Send,
  Truck,
  Volume2,
  Wifi,
  XCircle,
} from 'lucide-react';
import type { FormEvent, MutableRefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ComandaStatus, type Comanda } from '../../domain/comanda/Comanda';
import type { Order } from '../../domain/order/Order';
import { OrderStatus, OrderType } from '../../domain/order/Order';
import type { StoreSettings } from '../../application/repositories/StoreSettingsRepository';
import {
  isSupabaseConfigured,
  supabaseClient,
} from '../../infrastructure/supabase/supabaseClient';
import { createCustomerDependencies } from '../customer/customerDependencies';
import {
  formatOrderDateTime,
  getOrderDisplayNumber,
} from '../orderPresentation';
import {
  notifyApplicationLockStatusChanged,
  useApplicationLockStatus,
} from '../useApplicationLockStatus';
import { AdminCommandasPanel } from './AdminCommandasPanel';
import { calculateAdminDailyRevenue } from './adminRevenue';
import { AdminMonitoringPanel } from './AdminMonitoringPanel';
import { AdminProductsPanel } from './AdminProductsPanel';
import { AdminStoreSettingsPanel } from './AdminStoreSettingsPanel';
import {
  activeOrderStatuses,
  filterActiveOrdersByStatus,
  getActiveOrderStatusCounts,
  sortActiveOrdersByPriority,
  type ActiveOrderStatusFilter,
} from './orderFilters';
import { getNewOrders, getNewlyCanceledOrders } from './orderNotifications';
import { buildOrderWhatsAppUrl } from './orderWhatsapp';
import {
  getRealtimeStatusPresentation,
  type RealtimeConnectionStatus,
} from './realtimeStatus';

type AdminSection =
  | 'orders'
  | 'commandas'
  | 'history'
  | 'products'
  | 'settings'
  | 'monitoring';
type HistoryStatusFilter = 'ALL' | OrderStatus.FINISHED | OrderStatus.CANCELED;

const cancellationReasonOptions = [
  'Produto indisponivel',
  'Cliente desistiu',
  'Loja fechou',
  'Endereco fora do atendimento',
  'Outro motivo',
];

const {
  getApplicationLockStatusUseCase,
  getStoreSettingsUseCase,
  listCommandasUseCase,
  listOrdersUseCase,
  repositoryMode,
  setApplicationLockStatusUseCase,
  setStoreSettingsUseCase,
  updateOrderEstimateUseCase,
  updateOrderStatusUseCase,
} = createCustomerDependencies();

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

const orderStatusLabel: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'Pendente',
  [OrderStatus.ACCEPTED]: 'Aceito',
  [OrderStatus.IN_PREPARATION]: 'Em preparo',
  [OrderStatus.OUT_FOR_DELIVERY]: 'Saiu para entrega',
  [OrderStatus.READY_FOR_PICKUP]: 'Pronto para retirada',
  [OrderStatus.FINISHED]: 'Finalizado',
  [OrderStatus.CANCELED]: 'Cancelado',
};

const getUserFacingErrorMessage = (
  error: unknown,
  fallbackMessage: string,
): string => {
  if (!(error instanceof Error)) {
    return fallbackMessage;
  }

  if (
    error.message.includes('JWT') ||
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

  if (error.message.includes('Cancellation reason')) {
    return 'Informe o motivo do cancelamento.';
  }

  return error.message;
};

const getStatusConfirmationMessage = (order: Order): string => {
  return `Finalizar o pedido de ${order.customerName}?`;
};

const getNextStatusActions = (order: Order) => {
  if (order.status === OrderStatus.PENDING) {
    return [
      {
        status: OrderStatus.ACCEPTED,
        label: 'Aceitar',
        Icon: CheckCircle2,
      },
      {
        status: OrderStatus.CANCELED,
        label: 'Cancelar',
        Icon: XCircle,
      },
    ];
  }

  if (order.status === OrderStatus.ACCEPTED) {
    return [
      {
        status: OrderStatus.IN_PREPARATION,
        label: 'Preparar',
        Icon: Flame,
      },
      {
        status: OrderStatus.CANCELED,
        label: 'Cancelar',
        Icon: XCircle,
      },
    ];
  }

  if (order.status === OrderStatus.IN_PREPARATION) {
    return [
      {
        status:
          order.type === OrderType.DELIVERY
            ? OrderStatus.OUT_FOR_DELIVERY
            : OrderStatus.READY_FOR_PICKUP,
        label: order.type === OrderType.DELIVERY ? 'Saiu' : 'Pronto',
        Icon: order.type === OrderType.DELIVERY ? Truck : PackageCheck,
      },
    ];
  }

  if (
    order.status === OrderStatus.OUT_FOR_DELIVERY ||
    order.status === OrderStatus.READY_FOR_PICKUP
  ) {
    return [
      {
        status: OrderStatus.FINISHED,
        label: 'Finalizar',
        Icon: CheckCircle2,
      },
    ];
  }

  return [];
};

const isAdminSession = (session: Session | null): boolean =>
  session?.user.app_metadata.role === 'admin';

const isOwnerSession = (session: Session | null): boolean =>
  session?.user.app_metadata.owner === true ||
  session?.user.app_metadata.owner === 'true';

const isHistoryOrder = (order: Order): boolean =>
  order.status === OrderStatus.FINISHED ||
  order.status === OrderStatus.CANCELED;

const isMissingEstimate = (order: Order): boolean =>
  !isHistoryOrder(order) && !order.estimatedReadyAt;

const isSameLocalDate = (date: Date | undefined, referenceDate: Date): boolean =>
  date !== undefined && date.toDateString() === referenceDate.toDateString();

const formatDateTimeLocalInput = (date?: Date): string => {
  if (!date) {
    return '';
  }

  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;

  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
};

const normalizeSearch = (value: string): string =>
  value.replace(/\D/g, '').toLowerCase();

type AudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

const activeOrderFilterLabels: Record<ActiveOrderStatusFilter, string> = {
  ALL: 'Todos',
  [OrderStatus.PENDING]: 'Pendentes',
  [OrderStatus.ACCEPTED]: 'Aceitos',
  [OrderStatus.IN_PREPARATION]: 'Em preparo',
  [OrderStatus.OUT_FOR_DELIVERY]: 'Em entrega',
  [OrderStatus.READY_FOR_PICKUP]: 'Prontos',
};

const HISTORY_PAGE_SIZE = 50;
const HISTORY_STATUSES = [OrderStatus.FINISHED, OrderStatus.CANCELED];

const playNewOrderSound = (
  audioContextRef: MutableRefObject<AudioContext | null>,
): boolean => {
  const AudioContextClass =
    window.AudioContext ?? (window as AudioWindow).webkitAudioContext;

  if (!AudioContextClass) {
    return false;
  }

  const audioContext =
    audioContextRef.current ?? new AudioContextClass();
  audioContextRef.current = audioContext;

  if (audioContext.state === 'suspended') {
    void audioContext.resume();
  }

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const startTime = audioContext.currentTime;

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(880, startTime);
  oscillator.frequency.setValueAtTime(660, startTime + 0.12);
  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.18, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.32);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + 0.34);

  return true;
};

const playCanceledOrderSound = (
  audioContextRef: MutableRefObject<AudioContext | null>,
): boolean => {
  const AudioContextClass =
    window.AudioContext ?? (window as AudioWindow).webkitAudioContext;

  if (!AudioContextClass) {
    return false;
  }

  const audioContext = audioContextRef.current ?? new AudioContextClass();
  audioContextRef.current = audioContext;

  if (audioContext.state === 'suspended') {
    void audioContext.resume();
  }

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const startTime = audioContext.currentTime;

  // Timbre grave e descendente, distinto do som de novo pedido.
  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(320, startTime);
  oscillator.frequency.setValueAtTime(220, startTime + 0.16);
  oscillator.frequency.setValueAtTime(180, startTime + 0.32);
  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.14, startTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + 0.52);

  return true;
};

export function AdminApp() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [closedCommandas, setClosedCommandas] = useState<Comanda[]>([]);
  const ordersRef = useRef<Order[]>([]);
  const hasCompletedInitialLoadRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isSoundEnabledRef = useRef(false);
  const [adminSection, setAdminSection] = useState<AdminSection>('orders');
  const [activeStatusFilter, setActiveStatusFilter] =
    useState<ActiveOrderStatusFilter>('ALL');
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] =
    useState<HistoryStatusFilter>('ALL');
  const [historyDateFilter, setHistoryDateFilter] = useState('');
  const [historyPage, setHistoryPage] = useState(0);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isCheckingSession, setIsCheckingSession] = useState(
    repositoryMode === 'supabase',
  );
  const [isUpdatingApplicationLock, setIsUpdatingApplicationLock] =
    useState(false);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    storeOpen: true,
    deliveryFee: 8,
  });
  const [isUpdatingStore, setIsUpdatingStore] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [updatingEstimateOrderId, setUpdatingEstimateOrderId] = useState<
    string | null
  >(null);
  const [estimateInputs, setEstimateInputs] = useState<Record<string, string>>(
    {},
  );
  const [cancelingOrder, setCancelingOrder] = useState<Order | null>(null);
  const [selectedCancellationReason, setSelectedCancellationReason] =
    useState('');
  const [cancellationReason, setCancellationReason] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [authErrorMessage, setAuthErrorMessage] = useState('');
  const [newOrderNoticeCount, setNewOrderNoticeCount] = useState(0);
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeConnectionStatus>('unavailable');
  const {
    isCheckingApplicationLock,
    isApplicationLocked,
    refreshApplicationLockStatus,
  } = useApplicationLockStatus(
    'admin-application-lock',
    getApplicationLockStatusUseCase,
  );

  const requiresAuthentication =
    repositoryMode === 'supabase' && isSupabaseConfigured;
  const isAuthenticated = session !== null;
  const isAdmin = isAdminSession(session);
  const isOwner = isOwnerSession(session);
  const canAccessAdmin =
    !requiresAuthentication ||
    ((isAdmin || isOwner) && (!isApplicationLocked || isOwner));
  const shouldShowApplicationUnavailable =
    requiresAuthentication &&
    isAuthenticated &&
    isAdmin &&
    isApplicationLocked &&
    !isOwner;
  const activeOrderCounts = getActiveOrderStatusCounts(orders);
  const activeOrders = sortActiveOrdersByPriority(
    filterActiveOrdersByStatus(orders, activeStatusFilter),
  );
  const historyOrders = orders.filter(isHistoryOrder);
  const today = new Date();
  const todayRevenue = calculateAdminDailyRevenue(
    historyOrders,
    closedCommandas,
    today,
  );
  const filteredHistoryOrders = historyOrders.filter((order) => {
    const search = historySearch.trim().toLowerCase();
    const numericSearch = normalizeSearch(historySearch);
    const displayNumber = getOrderDisplayNumber(order).toLowerCase();
    const matchesPhone =
      numericSearch !== '' &&
      normalizeSearch(order.customerPhone).includes(numericSearch);
    const matchesSearch =
      search === '' ||
      order.customerName.toLowerCase().includes(search) ||
      displayNumber.includes(search) ||
      matchesPhone;
    const matchesStatus =
      historyStatusFilter === 'ALL' || order.status === historyStatusFilter;
    const matchesDate =
      historyDateFilter === '' ||
      (order.createdAt?.toISOString().slice(0, 10) ?? '') === historyDateFilter;

    return matchesSearch && matchesStatus && matchesDate;
  });
  const visibleOrders =
    adminSection === 'history' ? filteredHistoryOrders : activeOrders;
  const realtimeStatusPresentation =
    getRealtimeStatusPresentation(realtimeStatus);

  useEffect(() => {
    setEstimateInputs((currentInputs) => {
      const nextInputs = { ...currentInputs };

      orders.forEach((order) => {
        if (!order.id || nextInputs[order.id] !== undefined) {
          return;
        }

        nextInputs[order.id] = formatDateTimeLocalInput(
          order.estimatedReadyAt,
        );
      });

      return nextInputs;
    });
  }, [orders]);

  async function loadOrders(
    options: { historyPage?: number; notifyNewOrders?: boolean } = {},
  ) {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const nextHistoryPage = options.historyPage ?? historyPage;
        const [nextActiveOrders, nextHistoryOrders, nextClosedCommandas] =
          await Promise.all([
        listOrdersUseCase.execute({
          statuses: [...activeOrderStatuses],
        }),
        listOrdersUseCase.execute({
          statuses: HISTORY_STATUSES,
          limit: HISTORY_PAGE_SIZE + 1,
          offset: nextHistoryPage * HISTORY_PAGE_SIZE,
        }),
        listCommandasUseCase.execute({
          statuses: [ComandaStatus.CLOSED],
        }),
      ]);
      const visibleHistoryOrders = nextHistoryOrders.slice(0, HISTORY_PAGE_SIZE);
      const nextOrders = [...nextActiveOrders, ...visibleHistoryOrders];
      const newOrders = getNewOrders(
        ordersRef.current,
        nextOrders,
        hasCompletedInitialLoadRef.current,
      );
      const newlyCanceledOrders = getNewlyCanceledOrders(
        ordersRef.current,
        nextOrders,
        hasCompletedInitialLoadRef.current,
      );

      ordersRef.current = nextOrders;
      hasCompletedInitialLoadRef.current = true;
      setHasMoreHistory(nextHistoryOrders.length > HISTORY_PAGE_SIZE);
      setOrders(nextOrders);
      setClosedCommandas(nextClosedCommandas);

      if (options.notifyNewOrders && newOrders.length > 0) {
        setNewOrderNoticeCount((currentCount) => currentCount + newOrders.length);
        setAdminSection('orders');

        if (isSoundEnabledRef.current) {
          playNewOrderSound(audioContextRef);
        }
      }

      if (newlyCanceledOrders.length > 0 && isSoundEnabledRef.current) {
        playCanceledOrderSound(audioContextRef);
      }
    } catch (error) {
      setErrorMessage(
        getUserFacingErrorMessage(
          error,
          'Nao foi possivel carregar os pedidos.',
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }

  function resetHistoryPage() {
    setHistoryPage(0);
    void loadOrders({ historyPage: 0 });
  }

  function goToPreviousHistoryPage() {
    const previousPage = Math.max(historyPage - 1, 0);

    setHistoryPage(previousPage);
    void loadOrders({ historyPage: previousPage });
  }

  function goToNextHistoryPage() {
    const nextPage = historyPage + 1;

    setHistoryPage(nextPage);
    void loadOrders({ historyPage: nextPage });
  }

  function enableSound() {
    if (playNewOrderSound(audioContextRef)) {
      setIsSoundEnabled(true);
    }
  }

  useEffect(() => {
    isSoundEnabledRef.current = isSoundEnabled;
  }, [isSoundEnabled]);

  useEffect(() => {
    if (!requiresAuthentication || supabaseClient === null) {
      setIsCheckingSession(false);
      return;
    }

    let isMounted = true;

    supabaseClient.auth.getSession().then(({ data }) => {
      if (isMounted) {
        setSession(data.session);
        setIsCheckingSession(false);
      }
    });

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [requiresAuthentication]);

  useEffect(() => {
    if (canAccessAdmin) {
      loadOrders();
    } else {
      ordersRef.current = [];
      hasCompletedInitialLoadRef.current = false;
      setIsLoading(false);
      setOrders([]);
      setClosedCommandas([]);
    }
  }, [canAccessAdmin]);

  useEffect(() => {
    if (
      !canAccessAdmin ||
      repositoryMode !== 'supabase' ||
      supabaseClient === null
    ) {
      setRealtimeStatus(
        repositoryMode === 'supabase' ? 'idle' : 'unavailable',
      );
      return;
    }

    const realtimeClient = supabaseClient;
    setRealtimeStatus('connecting');

    const channel = realtimeClient
      .channel('admin-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload: { eventType: string }) => {
          void loadOrders({ notifyNewOrders: payload.eventType === 'INSERT' });
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
          return;
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('error');
          return;
        }

        if (status === 'CLOSED') {
          setRealtimeStatus('disconnected');
        }
      });

    return () => {
      setRealtimeStatus('disconnected');
      void realtimeClient.removeChannel(channel);
    };
  }, [canAccessAdmin]);

  useEffect(() => {
    if (!canAccessAdmin) {
      return;
    }

    let isMounted = true;

    async function refreshStoreSettings() {
      try {
        const settings = await getStoreSettingsUseCase.execute();

        if (isMounted) {
          setStoreSettings(settings);
        }
      } catch {
        // Mantem o ultimo valor conhecido se a leitura falhar.
      }
    }

    void refreshStoreSettings();

    if (!isSupabaseConfigured || supabaseClient === null) {
      return () => {
        isMounted = false;
      };
    }

    const realtimeClient = supabaseClient;
    const channel = realtimeClient
      .channel('admin-store-settings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
          filter: 'key=eq.store_settings',
        },
        () => {
          void refreshStoreSettings();
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      void realtimeClient.removeChannel(channel);
    };
  }, [canAccessAdmin]);

  async function toggleStoreOpen() {
    setIsUpdatingStore(true);
    setErrorMessage('');

    try {
      const settings = await setStoreSettingsUseCase.execute({
        ...storeSettings,
        storeOpen: !storeSettings.storeOpen,
      });

      setStoreSettings(settings);
    } catch (error) {
      setErrorMessage(
        getUserFacingErrorMessage(
          error,
          'Nao foi possivel alterar a disponibilidade da loja.',
        ),
      );
    } finally {
      setIsUpdatingStore(false);
    }
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (supabaseClient === null) {
      setAuthErrorMessage('Supabase is not configured');
      return;
    }

    setIsSigningIn(true);
    setAuthErrorMessage('');

    const { error } = await supabaseClient.auth.signInWithPassword({
      email: authEmail.trim(),
      password: authPassword,
    });

    if (error) {
      setAuthErrorMessage(
        getUserFacingErrorMessage(
          error,
          'Nao foi possivel entrar no painel administrativo.',
        ),
      );
    }

    setIsSigningIn(false);
  }

  async function signOut() {
    if (supabaseClient === null) {
      return;
    }

    await supabaseClient.auth.signOut();
    ordersRef.current = [];
    hasCompletedInitialLoadRef.current = false;
    setNewOrderNoticeCount(0);
    setOrders([]);
    setClosedCommandas([]);
  }

  async function toggleApplicationLock() {
    setIsUpdatingApplicationLock(true);
    setErrorMessage('');

    try {
      await setApplicationLockStatusUseCase.execute({
        locked: !isApplicationLocked,
      });

      notifyApplicationLockStatusChanged();
      await refreshApplicationLockStatus();
    } catch (error) {
      setErrorMessage(
        getUserFacingErrorMessage(
          error,
          'Nao foi possivel alterar a disponibilidade da aplicacao.',
        ),
      );
    } finally {
      setIsUpdatingApplicationLock(false);
    }
  }

  async function updateStatus(order: Order, status: OrderStatus) {
    if (!order.id) {
      return;
    }

    if (
      status === OrderStatus.FINISHED &&
      !window.confirm(getStatusConfirmationMessage(order))
    ) {
      return;
    }

    if (status === OrderStatus.CANCELED) {
      setCancelingOrder(order);
      setSelectedCancellationReason('');
      setCancellationReason('');
      return;
    }

    setUpdatingOrderId(order.id);
    setErrorMessage('');

    try {
      const updatedOrder = await updateOrderStatusUseCase.execute({
        orderId: order.id,
        status,
        cancellationReason,
      });

      setOrders((currentOrders) => {
        const nextOrders = currentOrders.map((currentOrder) =>
          currentOrder.id === updatedOrder.id ? updatedOrder : currentOrder,
        );
        ordersRef.current = nextOrders;

        return nextOrders;
      });
    } catch (error) {
      setErrorMessage(
        getUserFacingErrorMessage(
          error,
          'Nao foi possivel atualizar o pedido.',
        ),
      );
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function confirmCancellation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!cancelingOrder?.id) {
      return;
    }

    const reason =
      selectedCancellationReason === 'Outro motivo'
        ? cancellationReason.trim()
        : selectedCancellationReason;

    if (!reason) {
      setErrorMessage('Informe o motivo do cancelamento.');
      return;
    }

    setUpdatingOrderId(cancelingOrder.id);
    setErrorMessage('');

    try {
      const updatedOrder = await updateOrderStatusUseCase.execute({
        orderId: cancelingOrder.id,
        status: OrderStatus.CANCELED,
        cancellationReason: reason,
      });

      setOrders((currentOrders) => {
        const nextOrders = currentOrders.map((currentOrder) =>
          currentOrder.id === updatedOrder.id ? updatedOrder : currentOrder,
        );
        ordersRef.current = nextOrders;

        return nextOrders;
      });
      setCancelingOrder(null);
      setSelectedCancellationReason('');
      setCancellationReason('');
    } catch (error) {
      setErrorMessage(
        getUserFacingErrorMessage(
          error,
          'Nao foi possivel cancelar o pedido.',
        ),
      );
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function saveEstimate(order: Order) {
    if (!order.id) {
      return;
    }

    const inputValue = estimateInputs[order.id] ?? '';
    const estimatedReadyAt = inputValue ? new Date(inputValue) : undefined;

    if (inputValue && Number.isNaN(estimatedReadyAt?.getTime())) {
      setErrorMessage('Informe uma previsao valida.');
      return;
    }

    setUpdatingEstimateOrderId(order.id);
    setErrorMessage('');

    try {
      const updatedOrder = await updateOrderEstimateUseCase.execute({
        orderId: order.id,
        estimatedReadyAt,
      });

      setOrders((currentOrders) => {
        const nextOrders = currentOrders.map((currentOrder) =>
          currentOrder.id === updatedOrder.id ? updatedOrder : currentOrder,
        );
        ordersRef.current = nextOrders;

        return nextOrders;
      });
    } catch (error) {
      setErrorMessage(
        getUserFacingErrorMessage(
          error,
          'Nao foi possivel salvar a previsao.',
        ),
      );
    } finally {
      setUpdatingEstimateOrderId(null);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-normal text-emerald-700">
              Administrativo
            </p>
            <h1 className="text-3xl font-semibold tracking-normal text-zinc-950">
              Pedidos recebidos
            </h1>
            <p className="mt-2 text-xs font-medium text-zinc-500">
              Fonte: {repositoryMode === 'supabase' ? 'Supabase' : 'local'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canAccessAdmin ? (
              <>
              {isOwner ? (
                <button
                  className={`flex h-11 items-center justify-center gap-2 rounded border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    isApplicationLocked
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:border-emerald-400'
                      : 'border-rose-300 bg-rose-50 text-rose-900 hover:border-rose-400'
                  }`}
                  disabled={isUpdatingApplicationLock}
                  type="button"
                  onClick={toggleApplicationLock}
                >
                  <LockKeyhole className="h-4 w-4" />
                  {isApplicationLocked
                    ? 'Liberar aplicacao'
                    : 'Bloquear aplicacao'}
                </button>
              ) : null}
              <button
                className={`flex h-11 items-center justify-center gap-2 rounded border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  storeSettings.storeOpen
                    ? 'border-rose-300 bg-rose-50 text-rose-900 hover:border-rose-400'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:border-emerald-400'
                }`}
                disabled={isUpdatingStore}
                type="button"
                onClick={toggleStoreOpen}
              >
                <Power className="h-4 w-4" />
                {storeSettings.storeOpen ? 'Fechar loja' : 'Abrir loja'}
              </button>
              <button
                className="flex h-11 items-center justify-center gap-2 rounded border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400"
                type="button"
                onClick={() => loadOrders()}
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </button>
              {isSoundEnabled ? (
                <span className="flex h-11 items-center justify-center gap-2 rounded border border-emerald-300 bg-emerald-50 px-4 text-sm font-semibold text-emerald-900">
                  <Volume2 className="h-4 w-4" />
                  Som ativo
                </span>
              ) : (
                <button
                  className="flex h-11 items-center justify-center gap-2 rounded border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400"
                  type="button"
                  onClick={enableSound}
                >
                  <Volume2 className="h-4 w-4" />
                  Ativar som
                </button>
              )}
              <span
                className={`flex h-11 items-center justify-center gap-2 rounded border px-4 text-sm font-semibold ${realtimeStatusPresentation.className}`}
              >
                <Wifi className="h-4 w-4" />
                {realtimeStatusPresentation.label}
              </span>
              </>
            ) : null}

            {requiresAuthentication && isAuthenticated ? (
              <button
                className="flex h-11 items-center justify-center gap-2 rounded border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400"
                type="button"
                onClick={signOut}
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-6">
        {isCheckingSession || isCheckingApplicationLock ? (
          <div className="rounded border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
            Verificando acesso...
          </div>
        ) : null}

        {!isCheckingSession && !isCheckingApplicationLock && requiresAuthentication && isAuthenticated && !isAdmin && !isOwner ? (
          <div className="mx-auto grid max-w-md gap-4 rounded border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900 shadow-sm">
            <div className="flex items-center gap-2 font-semibold">
              <LockKeyhole className="h-5 w-5" />
              Acesso restrito
            </div>
            <p>
              Seu usuario esta autenticado, mas nao possui permissao de
              administrador.
            </p>
            <button
              className="h-11 rounded bg-rose-700 text-sm font-semibold text-white transition hover:bg-rose-800"
              type="button"
              onClick={signOut}
            >
              Sair
            </button>
          </div>
        ) : null}

        {!isCheckingSession && !isCheckingApplicationLock && requiresAuthentication && !isAuthenticated ? (
          <form
            className="mx-auto grid max-w-md gap-4 rounded border border-zinc-200 bg-white p-5 shadow-sm"
            onSubmit={signIn}
          >
            <div className="flex items-center gap-2 text-zinc-950">
              <LockKeyhole className="h-5 w-5 text-rose-700" />
              <h2 className="text-lg font-semibold">Acesso administrativo</h2>
            </div>

            <label className="grid gap-1 text-sm font-medium text-zinc-700">
              E-mail
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  className="h-10 w-full rounded border border-zinc-300 pl-9 pr-3 text-sm text-zinc-950 outline-none transition focus:border-rose-700"
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                />
              </div>
            </label>

            <label className="grid gap-1 text-sm font-medium text-zinc-700">
              Senha
              <input
                className="h-10 rounded border border-zinc-300 px-3 text-sm text-zinc-950 outline-none transition focus:border-rose-700"
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
              />
            </label>

            {authErrorMessage ? (
              <p className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                {authErrorMessage}
              </p>
            ) : null}

            <button
              className="h-11 rounded bg-rose-700 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSigningIn}
              type="submit"
            >
              {isSigningIn ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        ) : null}

        {!isCheckingSession && !isCheckingApplicationLock && shouldShowApplicationUnavailable ? (
          <div className="mx-auto grid max-w-md gap-4 rounded border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900 shadow-sm">
            <div className="flex items-center gap-2 font-semibold">
              <LockKeyhole className="h-5 w-5" />
              Aplicacao indisponivel
            </div>
            <p>Entre em contato com o administrador.</p>
            <button
              className="h-11 rounded bg-rose-700 text-sm font-semibold text-white transition hover:bg-rose-800"
              type="button"
              onClick={signOut}
            >
              Sair
            </button>
          </div>
        ) : null}

        {cancelingOrder ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/40 px-4">
            <form
              className="w-full max-w-md rounded border border-zinc-200 bg-white p-5 shadow-lg"
              onSubmit={confirmCancellation}
            >
              <h2 className="text-lg font-semibold text-zinc-950">
                Cancelar pedido
              </h2>
              <p className="mt-2 text-sm text-zinc-600">
                Informe o motivo do cancelamento de{' '}
                <span className="font-semibold text-zinc-950">
                  {cancelingOrder.customerName}
                </span>
                .
              </p>
              <div className="mt-4 grid gap-2">
                {cancellationReasonOptions.map((reasonOption) => (
                  <label
                    key={reasonOption}
                    className={`flex items-center gap-2 rounded border px-3 py-2 text-sm font-medium transition ${
                      selectedCancellationReason === reasonOption
                        ? 'border-rose-700 bg-rose-50 text-rose-900'
                        : 'border-zinc-200 bg-white text-zinc-700'
                    }`}
                  >
                    <input
                      checked={selectedCancellationReason === reasonOption}
                      className="h-4 w-4 accent-rose-700"
                      name="cancellation-reason"
                      type="radio"
                      value={reasonOption}
                      onChange={(event) => {
                        setSelectedCancellationReason(event.target.value);
                        setErrorMessage('');
                      }}
                    />
                    {reasonOption}
                  </label>
                ))}
              </div>
              {selectedCancellationReason === 'Outro motivo' ? (
                <textarea
                  className="mt-4 min-h-28 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-rose-700"
                  placeholder="Descreva o motivo"
                  value={cancellationReason}
                  onChange={(event) => {
                    setCancellationReason(event.target.value);
                    setErrorMessage('');
                  }}
                />
              ) : null}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  className="h-10 rounded border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400"
                  type="button"
                  onClick={() => {
                    setCancelingOrder(null);
                    setSelectedCancellationReason('');
                    setCancellationReason('');
                  }}
                >
                  Voltar
                </button>
                <button
                  className="h-10 rounded bg-rose-700 px-4 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={updatingOrderId === cancelingOrder.id}
                  type="submit"
                >
                  Confirmar cancelamento
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {!canAccessAdmin ? null : (
          <>
        {newOrderNoticeCount > 0 ? (
          <div className="mb-5 grid gap-3 rounded border border-amber-300 bg-amber-50 p-4 shadow-sm sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded bg-amber-100 text-amber-900">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-950">
                  {newOrderNoticeCount === 1
                    ? 'Novo pedido recebido'
                    : `${newOrderNoticeCount} novos pedidos recebidos`}
                </p>
                <p className="mt-1 text-sm text-amber-900">
                  Confira os detalhes antes de aceitar.
                </p>
              </div>
            </div>
            <button
              className="h-10 rounded border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-950 transition hover:border-amber-400"
              type="button"
              onClick={() => setNewOrderNoticeCount(0)}
            >
              Dispensar
            </button>
          </div>
        ) : null}

        <div className="mb-5 grid gap-3 rounded border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded bg-emerald-50 text-emerald-800">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-zinc-600">Faturado hoje</p>
              <p className="text-xl font-semibold text-zinc-950">
                  {formatCurrency(todayRevenue.totalRevenue)}
                </p>
              </div>
            </div>
            <p className="text-sm text-zinc-600">
             {todayRevenue.finishedOrdersCount} pedidos finalizados e{' '}
             {todayRevenue.closedCommandasCount} comandas fechadas hoje
            </p>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          <button
            className={`h-10 rounded px-4 text-sm font-semibold transition ${
              adminSection === 'orders'
                ? 'bg-zinc-950 text-white'
                : 'border border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400'
            }`}
            type="button"
            onClick={() => setAdminSection('orders')}
          >
            Pedidos
          </button>
          <button
            className={`h-10 rounded px-4 text-sm font-semibold transition ${
              adminSection === 'commandas'
                ? 'bg-zinc-950 text-white'
                : 'border border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400'
            }`}
            type="button"
            onClick={() => setAdminSection('commandas')}
          >
            Comandas
          </button>
          <button
            className={`h-10 rounded px-4 text-sm font-semibold transition ${
              adminSection === 'history'
                ? 'bg-zinc-950 text-white'
                : 'border border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400'
            }`}
            type="button"
            onClick={() => setAdminSection('history')}
          >
            Historico
          </button>
          <button
            className={`h-10 rounded px-4 text-sm font-semibold transition ${
              adminSection === 'products'
                ? 'bg-zinc-950 text-white'
                : 'border border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400'
            }`}
            type="button"
            onClick={() => setAdminSection('products')}
          >
            Produtos
          </button>
          {isOwner ? (
            <button
              className={`h-10 rounded px-4 text-sm font-semibold transition ${
                adminSection === 'monitoring'
                  ? 'bg-zinc-950 text-white'
                  : 'border border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400'
              }`}
              type="button"
              onClick={() => setAdminSection('monitoring')}
            >
              Monitoramento
            </button>
          ) : null}
          {isOwner ? (
            <button
              className={`h-10 rounded px-4 text-sm font-semibold transition ${
                adminSection === 'settings'
                  ? 'bg-zinc-950 text-white'
                  : 'border border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400'
              }`}
              type="button"
              onClick={() => setAdminSection('settings')}
            >
              Configuracoes
            </button>
          ) : null}
        </div>

        {adminSection === 'commandas' ? (
          <AdminCommandasPanel onCommandasChanged={() => loadOrders()} />
        ) : null}
        {adminSection === 'products' ? <AdminProductsPanel /> : null}
        {adminSection === 'settings' ? <AdminStoreSettingsPanel /> : null}
        {adminSection === 'monitoring' && isOwner ? (
          <AdminMonitoringPanel
            isApplicationLocked={isApplicationLocked}
            realtimeStatus={realtimeStatus}
          />
        ) : null}

        {adminSection === 'orders' || adminSection === 'history' ? (
          <>
        {adminSection === 'orders' ? (
          <div className="mb-5 grid gap-3 rounded border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {(['ALL', ...activeOrderStatuses] as ActiveOrderStatusFilter[]).map(
                (statusFilter) => {
                  const count =
                    statusFilter === 'ALL'
                      ? activeOrderCounts.total
                      : activeOrderCounts[statusFilter];
                  const isSelected = activeStatusFilter === statusFilter;

                  return (
                    <button
                      key={statusFilter}
                      className={`flex h-10 items-center gap-2 rounded border px-3 text-sm font-semibold transition ${
                        isSelected
                          ? 'border-zinc-950 bg-zinc-950 text-white'
                          : statusFilter === OrderStatus.PENDING && count > 0
                            ? 'border-amber-300 bg-amber-50 text-amber-950 hover:border-amber-400'
                            : 'border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400'
                      }`}
                      type="button"
                      onClick={() => setActiveStatusFilter(statusFilter)}
                    >
                      <span>{activeOrderFilterLabels[statusFilter]}</span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          isSelected
                            ? 'bg-white text-zinc-950'
                            : 'bg-zinc-100 text-zinc-700'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                },
              )}
            </div>
          </div>
        ) : null}

        {adminSection === 'history' ? (
          <div className="mb-5 grid gap-3 rounded border border-zinc-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_180px_180px]">
              <label className="grid gap-1 text-sm font-medium text-zinc-700">
                Buscar
                <input
                  className="h-10 rounded border border-zinc-300 px-3 text-sm text-zinc-950 outline-none transition focus:border-rose-700"
                  placeholder="Numero, telefone ou nome"
                  value={historySearch}
                  onChange={(event) => {
                    setHistorySearch(event.target.value);
                    resetHistoryPage();
                  }}
                />
              </label>
              <label className="grid gap-1 text-sm font-medium text-zinc-700">
                Status
                <select
                  className="h-10 rounded border border-zinc-300 px-3 text-sm text-zinc-950 outline-none transition focus:border-rose-700"
                  value={historyStatusFilter}
                  onChange={(event) => {
                    setHistoryStatusFilter(
                      event.target.value as HistoryStatusFilter,
                    );
                    resetHistoryPage();
                  }}
                >
                  <option value="ALL">Todos</option>
                  <option value={OrderStatus.FINISHED}>Finalizados</option>
                  <option value={OrderStatus.CANCELED}>Cancelados</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-zinc-700">
                Data
                <input
                  className="h-10 rounded border border-zinc-300 px-3 text-sm text-zinc-950 outline-none transition focus:border-rose-700"
                  type="date"
                  value={historyDateFilter}
                  onChange={(event) => {
                    setHistoryDateFilter(event.target.value);
                    resetHistoryPage();
                  }}
                />
              </label>
          </div>
        ) : null}

        {adminSection === 'history' ? (
          <div className="mb-5 flex flex-col gap-3 rounded border border-zinc-200 bg-white p-4 text-sm text-zinc-700 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <span>
              Pagina {historyPage + 1} do historico, ate {HISTORY_PAGE_SIZE}{' '}
              pedidos por vez.
            </span>
            <div className="flex gap-2">
              <button
                className="h-9 rounded border border-zinc-300 bg-white px-3 font-semibold text-zinc-800 transition hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={historyPage === 0 || isLoading}
                type="button"
                onClick={goToPreviousHistoryPage}
              >
                Anterior
              </button>
              <button
                className="h-9 rounded border border-zinc-300 bg-white px-3 font-semibold text-zinc-800 transition hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!hasMoreHistory || isLoading}
                type="button"
                onClick={goToNextHistoryPage}
              >
                Proxima
              </button>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
            Carregando pedidos...
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {errorMessage}
          </div>
        ) : null}

        {!isLoading && !errorMessage && visibleOrders.length === 0 ? (
          <div className="rounded border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
            {adminSection === 'history'
              ? 'Nenhum pedido no historico.'
              : 'Nenhum pedido ativo no momento.'}
          </div>
        ) : null}

        <div className="grid gap-4">
          {visibleOrders.map((order) => {
            const hasCustomerNote = Boolean(order.customerNote);
            const needsEstimate = isMissingEstimate(order);
            const cardClassName = `rounded border bg-white p-4 shadow-sm ${
              order.status === OrderStatus.PENDING
                ? 'border-amber-300 ring-1 ring-amber-100'
                : needsEstimate
                  ? 'border-orange-300 ring-1 ring-orange-100'
                  : hasCustomerNote
                    ? 'border-sky-300 ring-1 ring-sky-100'
                    : 'border-zinc-200'
            }`;

            return (
              <article key={order.id} className={cardClassName}>
              {(() => {
                const actions = getNextStatusActions(order);

                return (
                  <>
              <div className="flex flex-col gap-3 border-b border-zinc-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-zinc-950">
                      {order.customerName}
                    </h2>
                    <span className="rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
                      {getOrderDisplayNumber(order)}
                    </span>
                    <span className="rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                      {orderStatusLabel[order.status]}
                    </span>
                    {hasCustomerNote ? (
                      <span className="rounded bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800">
                        Observacao
                      </span>
                    ) : null}
                    {needsEstimate ? (
                      <span className="rounded bg-orange-50 px-2 py-1 text-xs font-medium text-orange-800">
                        Sem previsao
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-zinc-600">
                    {order.customerPhone}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {formatOrderDateTime(order.createdAt)}
                  </p>
                  {order.status === OrderStatus.FINISHED &&
                  order.finishedAt ? (
                    <p className="mt-1 text-sm text-zinc-600">
                      Finalizado em {formatOrderDateTime(order.finishedAt)}
                    </p>
                  ) : null}
                  {order.status === OrderStatus.CANCELED &&
                  order.cancellationReason ? (
                    <p className="mt-2 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
                      Motivo do cancelamento: {order.cancellationReason}
                    </p>
                  ) : null}
                  {order.customerNote ? (
                    <p className="mt-2 rounded border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
                      Observacao: {order.customerNote}
                    </p>
                  ) : null}
                  {order.estimatedReadyAt ? (
                    <p className="mt-2 text-sm text-zinc-600">
                      Previsao: {formatOrderDateTime(order.estimatedReadyAt)}
                    </p>
                  ) : needsEstimate ? (
                    <p className="mt-2 rounded border border-orange-200 bg-orange-50 p-3 text-sm text-orange-950">
                      Defina uma previsao para orientar a cozinha e o cliente.
                    </p>
                  ) : null}
                  {order.type === OrderType.DELIVERY ? (
                    <p className="mt-2 flex items-center gap-2 text-sm text-zinc-700">
                      <Truck className="h-4 w-4 text-rose-700" />
                      Entrega: {order.address}
                    </p>
                  ) : (
                    <p className="mt-2 flex items-center gap-2 text-sm text-zinc-700">
                      <PackageCheck className="h-4 w-4 text-emerald-700" />
                      Retirada no estabelecimento
                    </p>
                  )}
                </div>

                <div className="text-left sm:text-right">
                  <p className="text-sm text-zinc-600">Total</p>
                  <p className="text-xl font-semibold text-zinc-950">
                    {formatCurrency(order.total)}
                  </p>
                  <a
                    className="mt-3 inline-flex h-9 items-center gap-2 rounded border border-emerald-300 bg-emerald-50 px-3 text-sm font-semibold text-emerald-900 transition hover:border-emerald-400"
                    href={buildOrderWhatsAppUrl(order)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <Send className="h-4 w-4" />
                    WhatsApp
                  </a>
                  {actions.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2 sm:justify-end">
                      {actions.map(({ Icon, label, status }) => (
                        <button
                          key={status}
                          className="flex h-9 items-center gap-2 rounded border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={updatingOrderId === order.id}
                          type="button"
                          onClick={() => updateStatus(order, status)}
                        >
                          <Icon className="h-4 w-4" />
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 pt-4 lg:grid-cols-[1fr_260px]">
                <div>
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-950">
                    <ClipboardList className="h-4 w-4 text-rose-700" />
                    Itens
                  </div>
                  <div className="divide-y divide-zinc-100">
                    {order.items.map((item) => (
                      <div
                        key={`${order.id}-${item.product.name}`}
                        className="grid grid-cols-[1fr_auto] gap-3 py-3 first:pt-0 last:pb-0"
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
                      </div>
                    ))}
                  </div>
                </div>

                <dl className="space-y-2 border-t border-zinc-100 pt-4 text-sm lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                  {!isHistoryOrder(order) ? (
                    <div className="grid gap-2 border-b border-zinc-100 pb-3">
                      <dt className="text-zinc-600">Previsao</dt>
                      <dd className="grid gap-2">
                        {needsEstimate ? (
                          <p className="rounded border border-orange-200 bg-orange-50 p-2 text-xs font-medium text-orange-900">
                            Sem previsao definida
                          </p>
                        ) : null}
                        <input
                          className="h-10 rounded border border-zinc-300 px-3 text-sm text-zinc-950 outline-none transition focus:border-rose-700"
                          type="datetime-local"
                          value={order.id ? estimateInputs[order.id] ?? '' : ''}
                          onChange={(event) => {
                            if (!order.id) {
                              return;
                            }

                            setEstimateInputs((currentInputs) => ({
                              ...currentInputs,
                              [order.id as string]: event.target.value,
                            }));
                          }}
                        />
                        <button
                          className="h-9 rounded border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={updatingEstimateOrderId === order.id}
                          type="button"
                          onClick={() => saveEstimate(order)}
                        >
                          {updatingEstimateOrderId === order.id
                            ? 'Salvando...'
                            : 'Salvar previsao'}
                        </button>
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between">
                    <dt className="text-zinc-600">Subtotal</dt>
                    <dd className="font-semibold text-zinc-950">
                      {formatCurrency(order.subtotal)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-zinc-600">Taxa de entrega</dt>
                    <dd className="font-semibold text-zinc-950">
                      {formatCurrency(order.deliveryFee)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between border-t border-zinc-100 pt-2 text-base">
                    <dt className="font-semibold text-zinc-950">Total</dt>
                    <dd className="font-semibold text-zinc-950">
                      {formatCurrency(order.total)}
                    </dd>
                  </div>
                </dl>
              </div>
                  </>
                );
              })()}
              </article>
            );
          })}
        </div>
          </>
        ) : null}
          </>
        )}
      </section>
    </main>
  );
}
