import type { Order } from '../../domain/order/Order';
import { OrderStatus } from '../../domain/order/Order';

export type ActiveOrderStatusFilter =
  | 'ALL'
  | OrderStatus.PENDING
  | OrderStatus.ACCEPTED
  | OrderStatus.IN_PREPARATION
  | OrderStatus.OUT_FOR_DELIVERY
  | OrderStatus.READY_FOR_PICKUP;

export const activeOrderStatuses = [
  OrderStatus.PENDING,
  OrderStatus.ACCEPTED,
  OrderStatus.IN_PREPARATION,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.READY_FOR_PICKUP,
] as const;

export type ActiveOrderStatus = (typeof activeOrderStatuses)[number];

const activeStatusPriority: Record<ActiveOrderStatus, number> = {
  [OrderStatus.PENDING]: 0,
  [OrderStatus.ACCEPTED]: 1,
  [OrderStatus.IN_PREPARATION]: 2,
  [OrderStatus.OUT_FOR_DELIVERY]: 3,
  [OrderStatus.READY_FOR_PICKUP]: 4,
};

export type ActiveOrderStatusCounts = Record<ActiveOrderStatus, number> & {
  total: number;
};

export const isActiveOrderStatus = (
  status: OrderStatus,
): status is ActiveOrderStatus =>
  activeOrderStatuses.some((activeStatus) => activeStatus === status);

export const getActiveOrders = (orders: Order[]): Order[] =>
  orders.filter((order) => isActiveOrderStatus(order.status));

export const getActiveOrderStatusCounts = (
  orders: Order[],
): ActiveOrderStatusCounts => {
  const counts: ActiveOrderStatusCounts = {
    [OrderStatus.PENDING]: 0,
    [OrderStatus.ACCEPTED]: 0,
    [OrderStatus.IN_PREPARATION]: 0,
    [OrderStatus.OUT_FOR_DELIVERY]: 0,
    [OrderStatus.READY_FOR_PICKUP]: 0,
    total: 0,
  };

  for (const order of orders) {
    if (!isActiveOrderStatus(order.status)) {
      continue;
    }

    counts[order.status] += 1;
    counts.total += 1;
  }

  return counts;
};

export const filterActiveOrdersByStatus = (
  orders: Order[],
  statusFilter: ActiveOrderStatusFilter,
): Order[] => {
  const activeOrders = getActiveOrders(orders);

  if (statusFilter === 'ALL') {
    return activeOrders;
  }

  return activeOrders.filter((order) => order.status === statusFilter);
};

export const sortActiveOrdersByPriority = (orders: Order[]): Order[] =>
  [...orders].sort((firstOrder, secondOrder) => {
    if (
      !isActiveOrderStatus(firstOrder.status) ||
      !isActiveOrderStatus(secondOrder.status)
    ) {
      return 0;
    }

    const statusPriority =
      activeStatusPriority[firstOrder.status] -
      activeStatusPriority[secondOrder.status];

    if (statusPriority !== 0) {
      return statusPriority;
    }

    return (
      (firstOrder.createdAt?.getTime() ?? 0) -
      (secondOrder.createdAt?.getTime() ?? 0)
    );
  });
