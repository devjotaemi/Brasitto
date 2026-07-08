import { Activity, AlertTriangle, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { DatabaseMonitoringMetric } from '../../application/repositories/DatabaseMonitoringRepository';
import { OrderStatus } from '../../domain/order/Order';
import { createCustomerDependencies } from '../customer/customerDependencies';
import { activeOrderStatuses } from './orderFilters';
import type { RealtimeConnectionStatus } from './realtimeStatus';
import { getRealtimeStatusPresentation } from './realtimeStatus';
import {
  buildMonitoringAlerts,
  getMonitoringSummary,
  type MonitoringAlert,
  type MonitoringSummary,
} from './monitoringRules';

type AdminMonitoringPanelProps = {
  isApplicationLocked: boolean;
  realtimeStatus: RealtimeConnectionStatus;
};

type MonitoringState = {
  alerts: MonitoringAlert[];
  databaseMetrics: DatabaseMonitoringMetric[];
  summary: MonitoringSummary;
  storeOpen: boolean;
  deliveryFee: number;
};

const REFRESH_INTERVAL_MS = 30000;
const MONITORING_HISTORY_LIMIT = 200;
const MONITORING_HISTORY_STATUSES = [OrderStatus.FINISHED, OrderStatus.CANCELED];

const {
  getDatabaseMonitoringUseCase,
  getStoreSettingsUseCase,
  listOrdersUseCase,
  listProductsUseCase,
  repositoryMode,
} = createCustomerDependencies();

const emptySummary: MonitoringSummary = {
  activeProducts: 0,
  activeOrders: 0,
  pendingOrders: 0,
  missingEstimateOrders: 0,
  canceledToday: 0,
  finishedToday: 0,
  todayRevenue: 0,
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

const formatDuration = (seconds: number) => {
  if (seconds <= 0) {
    return '0s';
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0
      ? `${minutes}min ${remainingSeconds}s`
      : `${minutes}min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
};

const severityPresentation = {
  critical: {
    className: 'border-rose-200 bg-rose-50 text-rose-950',
    Icon: XCircle,
    label: 'Critico',
  },
  warning: {
    className: 'border-amber-200 bg-amber-50 text-amber-950',
    Icon: AlertTriangle,
    label: 'Atencao',
  },
  info: {
    className: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    Icon: CheckCircle2,
    label: 'OK',
  },
};

export function AdminMonitoringPanel({
  isApplicationLocked,
  realtimeStatus,
}: AdminMonitoringPanelProps) {
  const [monitoringState, setMonitoringState] =
    useState<MonitoringState | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const realtimePresentation = getRealtimeStatusPresentation(realtimeStatus);

  async function loadMonitoring() {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const [
        activeOrders,
        recentHistoryOrders,
        products,
        storeSettings,
        databaseMetrics,
      ] = await Promise.all([
        listOrdersUseCase.execute({
          statuses: [...activeOrderStatuses],
        }),
        listOrdersUseCase.execute({
          statuses: MONITORING_HISTORY_STATUSES,
          limit: MONITORING_HISTORY_LIMIT,
        }),
        listProductsUseCase.execute(),
        getStoreSettingsUseCase.execute(),
        getDatabaseMonitoringUseCase.execute(),
      ]);
      const orders = [...activeOrders, ...recentHistoryOrders];
      const now = new Date();
      const summary = getMonitoringSummary({
        now,
        orders,
        products,
      });

      setMonitoringState({
        alerts: buildMonitoringAlerts({
          now,
          orders,
          products,
          storeSettings,
          isApplicationLocked,
          realtimeStatus,
        }),
        databaseMetrics,
        summary,
        storeOpen: storeSettings.storeOpen,
        deliveryFee: storeSettings.deliveryFee,
      });
      setLastCheckedAt(now);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel carregar o monitoramento.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadMonitoring();

    const intervalId = window.setInterval(() => {
      void loadMonitoring();
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isApplicationLocked, realtimeStatus]);

  const summary = monitoringState?.summary ?? emptySummary;

  return (
    <section className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            Monitoramento
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Fonte: {repositoryMode === 'supabase' ? 'Supabase' : 'local'}
            {lastCheckedAt
              ? ` - atualizado em ${lastCheckedAt.toLocaleTimeString('pt-BR')}`
              : ''}
          </p>
        </div>
        <button
          className="flex h-10 items-center justify-center gap-2 rounded border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isLoading}
          type="button"
          onClick={loadMonitoring}
        >
          <RefreshCw className="h-4 w-4" />
          {isLoading ? 'Verificando...' : 'Verificar agora'}
        </button>
      </div>

      {errorMessage ? (
        <div className="rounded border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-600">Aplicacao</p>
          <p className="mt-2 text-xl font-semibold text-zinc-950">
            {isApplicationLocked ? 'Bloqueada' : 'Liberada'}
          </p>
        </article>
        <article className="rounded border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-600">Loja</p>
          <p className="mt-2 text-xl font-semibold text-zinc-950">
            {monitoringState
              ? monitoringState.storeOpen
                ? 'Aberta'
                : 'Fechada'
              : 'Verificando'}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Taxa {monitoringState ? formatCurrency(monitoringState.deliveryFee) : '--'}
          </p>
        </article>
        <article className="rounded border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-600">Realtime</p>
          <p className={`mt-2 inline-flex rounded border px-2 py-1 text-sm font-semibold ${realtimePresentation.className}`}>
            {realtimePresentation.label}
          </p>
        </article>
        <article className="rounded border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-600">Produtos ativos</p>
          <p className="mt-2 text-xl font-semibold text-zinc-950">
            {summary.activeProducts}
          </p>
        </article>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-600">Pedidos ativos</p>
          <p className="mt-2 text-xl font-semibold text-zinc-950">
            {summary.activeOrders}
          </p>
        </article>
        <article className="rounded border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-600">Pendentes</p>
          <p className="mt-2 text-xl font-semibold text-zinc-950">
            {summary.pendingOrders}
          </p>
        </article>
        <article className="rounded border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-600">Sem previsao</p>
          <p className="mt-2 text-xl font-semibold text-zinc-950">
            {summary.missingEstimateOrders}
          </p>
        </article>
        <article className="rounded border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-600">Faturado hoje</p>
          <p className="mt-2 text-xl font-semibold text-zinc-950">
            {formatCurrency(summary.todayRevenue)}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {summary.finishedToday} finalizados
          </p>
        </article>
      </div>

      <div className="rounded border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-950">
          <Activity className="h-4 w-4 text-rose-700" />
          Alertas
        </div>
        <div className="grid gap-3">
          {(monitoringState?.alerts ?? []).map((alert) => {
            const presentation = severityPresentation[alert.severity];
            const Icon = presentation.Icon;

            return (
              <article
                key={alert.id}
                className={`rounded border p-3 ${presentation.className}`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-normal">
                    {presentation.label}
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-semibold">{alert.title}</h3>
                <p className="mt-1 text-sm">{alert.description}</p>
              </article>
            );
          })}
        </div>
      </div>

      <div className="rounded border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-950">
          <Activity className="h-4 w-4 text-zinc-700" />
          Banco de dados
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {(monitoringState?.databaseMetrics ?? []).map((metric) => {
            const presentation = severityPresentation[metric.severity];
            const Icon = presentation.Icon;

            return (
              <article
                key={metric.metric}
                className={`rounded border p-3 ${presentation.className}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-normal">
                      {presentation.label}
                    </span>
                  </div>
                  <span className="text-sm font-semibold">{metric.count}</span>
                </div>
                <h3 className="mt-2 text-sm font-semibold">{metric.label}</h3>
                <p className="mt-1 text-sm">
                  Maior duracao: {formatDuration(metric.maxDurationSeconds)}
                </p>
                {metric.sampleApplicationName ? (
                  <p className="mt-1 text-xs opacity-80">
                    Origem: {metric.sampleApplicationName}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
