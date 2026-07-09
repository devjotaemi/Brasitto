import { ComandaStatus, type Comanda } from '../../domain/comanda/Comanda';
import { OrderStatus, type Order } from '../../domain/order/Order';

const isSameLocalDate = (date: Date | undefined, referenceDate: Date): boolean =>
  date !== undefined && date.toDateString() === referenceDate.toDateString();

export type AdminDailyRevenue = {
  finishedOrdersCount: number;
  closedCommandasCount: number;
  orderRevenue: number;
  comandaRevenue: number;
  totalRevenue: number;
};

export const calculateAdminDailyRevenue = (
  orders: Order[],
  commandas: Comanda[],
  referenceDate: Date,
): AdminDailyRevenue => {
  const todayFinishedOrders = orders.filter(
    (order) =>
      order.status === OrderStatus.FINISHED &&
      isSameLocalDate(order.finishedAt, referenceDate),
  );
  const todayClosedCommandas = commandas.filter(
    (comanda) =>
      comanda.status === ComandaStatus.CLOSED &&
      isSameLocalDate(comanda.closedAt, referenceDate),
  );
  const orderRevenue = todayFinishedOrders.reduce(
    (total, order) => total + order.total,
    0,
  );
  const comandaRevenue = todayClosedCommandas.reduce(
    (total, comanda) => total + comanda.total,
    0,
  );

  return {
    finishedOrdersCount: todayFinishedOrders.length,
    closedCommandasCount: todayClosedCommandas.length,
    orderRevenue,
    comandaRevenue,
    totalRevenue: orderRevenue + comandaRevenue,
  };
};
