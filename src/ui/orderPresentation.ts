import type { Order } from '../domain/order/Order';

export const getOrderDisplayNumber = (
  order: Pick<Order, 'id' | 'orderNumber'>,
): string => {
  if (order.orderNumber) {
    return `#${String(order.orderNumber).padStart(6, '0')}`;
  }

  if (!order.id) {
    return 'Pedido novo';
  }

  return `#${order.id.replace(/\W/g, '').slice(0, 8).toUpperCase()}`;
};

export const formatOrderDateTime = (createdAt?: Date): string => {
  if (!createdAt) {
    return 'Horario pendente';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(createdAt);
};
