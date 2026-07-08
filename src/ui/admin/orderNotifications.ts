import type { Order } from '../../domain/order/Order';

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
