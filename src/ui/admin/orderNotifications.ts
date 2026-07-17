import { OrderStatus, type Order } from '../../domain/order/Order';

export const getNewOrders = (
  previousOrders: Order[],
  nextOrders: Order[],
  hasCompletedInitialLoad: boolean,
): Order[] => {
  if (!hasCompletedInitialLoad) {
    return [];
  }

  const previousOrderIds = new Set(
    previousOrders
      .map((order) => order.id)
      .filter((id): id is string => id !== undefined),
  );

  return nextOrders.filter(
    (order) => order.id !== undefined && !previousOrderIds.has(order.id),
  );
};

export const getNewlyCanceledOrders = (
  previousOrders: Order[],
  nextOrders: Order[],
  hasCompletedInitialLoad: boolean,
): Order[] => {
  if (!hasCompletedInitialLoad) {
    return [];
  }

  const previousStatusById = new Map(
    previousOrders
      .filter((order): order is Order & { id: string } => order.id !== undefined)
      .map((order) => [order.id, order.status]),
  );

  return nextOrders.filter((order) => {
    if (order.id === undefined || order.status !== OrderStatus.CANCELED) {
      return false;
    }

    const previousStatus = previousStatusById.get(order.id);

    return previousStatus !== undefined && previousStatus !== OrderStatus.CANCELED;
  });
};
