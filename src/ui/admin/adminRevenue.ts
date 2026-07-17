import { ComandaStatus, type Comanda } from '../../domain/comanda/Comanda';
import { OrderStatus, type Order } from '../../domain/order/Order';

export const OPERATIONAL_DAY_START_HOUR = 6;

export type OperationalDayRange = {
  start: Date;
  end: Date;
};

export const getOperationalDayRange = (
  referenceDate: Date,
): OperationalDayRange => {
  const start = new Date(referenceDate);
  start.setHours(OPERATIONAL_DAY_START_HOUR, 0, 0, 0);

  if (referenceDate < start) {
    start.setDate(start.getDate() - 1);
  }

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
};

const isWithinOperationalDay = (
  date: Date | undefined,
  range: OperationalDayRange,
): boolean => date !== undefined && date >= range.start && date < range.end;

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
  const operationalDayRange = getOperationalDayRange(referenceDate);
  const todayFinishedOrders = orders.filter(
    (order) =>
      order.status === OrderStatus.FINISHED &&
      isWithinOperationalDay(order.finishedAt, operationalDayRange),
  );
  const todayClosedCommandas = commandas.filter(
    (comanda) =>
      comanda.status === ComandaStatus.CLOSED &&
      isWithinOperationalDay(comanda.closedAt, operationalDayRange),
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
