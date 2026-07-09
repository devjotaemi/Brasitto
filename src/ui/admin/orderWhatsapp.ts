import type { Order } from '../../domain/order/Order';
import { OrderStatus, OrderType } from '../../domain/order/Order';
import {
  formatOrderDateTime,
  getOrderDisplayNumber,
} from '../orderPresentation';

const WHATSAPP_COUNTRY_CODE = '55';

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

const normalizePhone = (value: string): string => value.replace(/\D/g, '');

export const getWhatsAppPhoneNumber = (phone: string): string => {
  const digits = normalizePhone(phone);

  if (digits.startsWith(WHATSAPP_COUNTRY_CODE)) {
    return digits;
  }

  return `${WHATSAPP_COUNTRY_CODE}${digits}`;
};

export const buildOrderWhatsAppMessage = (order: Order): string => {
  const orderNumber = getOrderDisplayNumber(order);

  if (order.status === OrderStatus.CANCELED) {
    return [
      `Ola, ${order.customerName}. Seu pedido ${orderNumber} na Espetaria foi cancelado.`,
      '',
      order.cancellationReason
        ? `Motivo: ${order.cancellationReason}`
        : 'Entre em contato conosco para mais detalhes.',
    ].join('\n');
  }

  const lines = [
    `Ola, ${order.customerName}! Seu pedido ${orderNumber} na Espetaria esta com o status: ${orderStatusLabel[order.status]}.`,
    '',
  ];

  if (order.estimatedReadyAt) {
    lines.push(`Previsao: ${formatOrderDateTime(order.estimatedReadyAt)}`);
  }

  if (order.status === OrderStatus.OUT_FOR_DELIVERY) {
    lines.push('Seu pedido saiu para entrega.');
  }

  if (order.status === OrderStatus.READY_FOR_PICKUP) {
    lines.push('Seu pedido esta pronto para retirada.');
  }

  lines.push(`Total: ${formatCurrency(order.total)}`);

  if (order.type === OrderType.DELIVERY && order.address) {
    lines.push(`Endereco: ${order.address}`);
  }

  lines.push('', 'Obrigado pelo pedido!');

  return lines.join('\n');
};

export const buildOrderWhatsAppUrl = (order: Order): string =>
  `https://wa.me/${getWhatsAppPhoneNumber(
    order.customerPhone,
  )}?text=${encodeURIComponent(buildOrderWhatsAppMessage(order))}`;
