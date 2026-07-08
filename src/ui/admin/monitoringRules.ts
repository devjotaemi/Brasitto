import type { StoreSettings } from '../../application/repositories/StoreSettingsRepository';
import { OrderStatus, type Order } from '../../domain/order/Order';
import type { Product } from '../../domain/product/Product';
import type { RealtimeConnectionStatus } from './realtimeStatus';

export type MonitoringSeverity = 'critical' | 'warning' | 'info';

export type MonitoringAlert = {
  id: string;
  severity: MonitoringSeverity;
  title: string;
  description: string;
};

export type MonitoringSummary = {
  activeProducts: number;
  activeOrders: number;
  pendingOrders: number;
  missingEstimateOrders: number;
  canceledToday: number;
  finishedToday: number;
  todayRevenue: number;
};

type BuildMonitoringInput = {
  orders: Order[];
  products: Product[];
  storeSettings: StoreSettings;
  isApplicationLocked: boolean;
  realtimeStatus: RealtimeConnectionStatus;
  now: Date;
};

const PENDING_ORDER_LIMIT_MINUTES = 15;
const CANCELED_TODAY_WARNING_LIMIT = 3;

const activeOrderStatuses = new Set<OrderStatus>([
  OrderStatus.PENDING,
  OrderStatus.ACCEPTED,
  OrderStatus.IN_PREPARATION,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.READY_FOR_PICKUP,
]);

const isSameLocalDate = (date: Date | undefined, referenceDate: Date): boolean =>
  date !== undefined && date.toDateString() === referenceDate.toDateString();

const isOlderThanMinutes = (
  date: Date | undefined,
  referenceDate: Date,
  minutes: number,
): boolean =>
  date !== undefined &&
  referenceDate.getTime() - date.getTime() > minutes * 60 * 1000;

export const getMonitoringSummary = ({
  now,
  orders,
  products,
}: Pick<BuildMonitoringInput, 'now' | 'orders' | 'products'>): MonitoringSummary => {
  const activeOrders = orders.filter((order) =>
    activeOrderStatuses.has(order.status),
  );
  const finishedToday = orders.filter(
    (order) =>
      order.status === OrderStatus.FINISHED &&
      isSameLocalDate(order.finishedAt, now),
  );

  return {
    activeProducts: products.filter((product) => product.active).length,
    activeOrders: activeOrders.length,
    pendingOrders: activeOrders.filter(
      (order) => order.status === OrderStatus.PENDING,
    ).length,
    missingEstimateOrders: activeOrders.filter(
      (order) => !order.estimatedReadyAt,
    ).length,
    canceledToday: orders.filter(
      (order) =>
        order.status === OrderStatus.CANCELED &&
        isSameLocalDate(order.createdAt, now),
    ).length,
    finishedToday: finishedToday.length,
    todayRevenue: finishedToday.reduce((total, order) => total + order.total, 0),
  };
};

export const buildMonitoringAlerts = (
  input: BuildMonitoringInput,
): MonitoringAlert[] => {
  const alerts: MonitoringAlert[] = [];
  const summary = getMonitoringSummary(input);
  const oldPendingOrders = input.orders.filter(
    (order) =>
      order.status === OrderStatus.PENDING &&
      isOlderThanMinutes(order.createdAt, input.now, PENDING_ORDER_LIMIT_MINUTES),
  );

  if (input.isApplicationLocked) {
    alerts.push({
      id: 'application-locked',
      severity: 'critical',
      title: 'Aplicacao bloqueada',
      description: 'Clientes e administradores comuns nao conseguem operar.',
    });
  }

  if (!input.storeSettings.storeOpen) {
    alerts.push({
      id: 'store-closed',
      severity: 'critical',
      title: 'Loja fechada',
      description: 'Novos pedidos estao bloqueados para clientes.',
    });
  }

  if (summary.activeProducts === 0) {
    alerts.push({
      id: 'no-active-products',
      severity: 'critical',
      title: 'Nenhum produto ativo',
      description: 'O cardapio publico nao tem itens disponiveis para venda.',
    });
  }

  if (input.realtimeStatus === 'error' || input.realtimeStatus === 'disconnected') {
    alerts.push({
      id: 'realtime-unavailable',
      severity: 'warning',
      title: 'Realtime desconectado',
      description: 'Use o botao Atualizar no admin ate a conexao voltar.',
    });
  }

  if (oldPendingOrders.length > 0) {
    alerts.push({
      id: 'old-pending-orders',
      severity: 'warning',
      title: 'Pedidos pendentes antigos',
      description: `${oldPendingOrders.length} pedido(s) pendente(s) ha mais de ${PENDING_ORDER_LIMIT_MINUTES} minutos.`,
    });
  }

  if (summary.missingEstimateOrders > 0) {
    alerts.push({
      id: 'missing-estimates',
      severity: 'warning',
      title: 'Pedidos sem previsao',
      description: `${summary.missingEstimateOrders} pedido(s) ativo(s) sem previsao de preparo/entrega.`,
    });
  }

  if (summary.canceledToday >= CANCELED_TODAY_WARNING_LIMIT) {
    alerts.push({
      id: 'many-cancellations',
      severity: 'warning',
      title: 'Cancelamentos acima do esperado',
      description: `${summary.canceledToday} pedido(s) cancelado(s) hoje.`,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: 'all-clear',
      severity: 'info',
      title: 'Nenhum alerta operacional',
      description: 'Aplicacao, loja, produtos e pedidos ativos parecem normais.',
    });
  }

  return alerts;
};
