import { describe, expect, it } from 'vitest';
import { Order, OrderStatus, OrderType } from '../../src/domain/order/Order';
import { Product } from '../../src/domain/product/Product';
import {
  buildOrderWhatsAppMessage,
  buildOrderWhatsAppUrl,
  getWhatsAppPhoneNumber,
} from '../../src/ui/admin/orderWhatsapp';

const product = Product.create({
  id: 'product-1',
  name: 'Espeto de Carne',
  description: 'Espeto bovino na brasa',
  price: 50,
  active: true,
});

const createOrder = () =>
  Order.create({
    id: 'order-1',
    orderNumber: 123,
    customerName: 'Maria Silva',
    customerPhone: '(11)99999-9999',
    type: OrderType.DELIVERY,
    address: 'Rua dos Espetos, 123',
    deliveryFee: 12,
    estimatedReadyAt: new Date('2026-05-20T11:30:00.000Z'),
    items: [
      {
        product,
        quantity: 2,
        unitPrice: 50,
        totalPrice: 100,
      },
    ],
  });

describe('orderWhatsapp', () => {
  it('normaliza telefone para link do WhatsApp brasileiro', () => {
    expect(getWhatsAppPhoneNumber('(11)99999-9999')).toBe('5511999999999');
    expect(getWhatsAppPhoneNumber('5511999999999')).toBe('5511999999999');
  });

  it('gera mensagem com status, previsao, total e endereco', () => {
    const order = createOrder().updateStatus(OrderStatus.IN_PREPARATION);

    expect(buildOrderWhatsAppMessage(order)).toContain(
      'Seu pedido #000123 na Espetaria esta com o status: Em preparo.',
    );
    expect(buildOrderWhatsAppMessage(order)).toContain('Previsao:');
    expect(buildOrderWhatsAppMessage(order)).toContain('Total: R$');
    expect(buildOrderWhatsAppMessage(order)).toContain(
      'Endereco: Rua dos Espetos, 123',
    );
  });

  it('gera mensagem de cancelamento com motivo', () => {
    const order = createOrder().updateStatus(
      OrderStatus.CANCELED,
      undefined,
      'Produto indisponivel',
    );

    expect(buildOrderWhatsAppMessage(order)).toBe(
      [
        'Ola, Maria Silva. Seu pedido #000123 na Espetaria foi cancelado.',
        '',
        'Motivo: Produto indisponivel',
      ].join('\n'),
    );
  });

  it('gera url do WhatsApp com mensagem codificada', () => {
    const order = createOrder().updateStatus(OrderStatus.ACCEPTED);

    expect(buildOrderWhatsAppUrl(order)).toContain(
      'https://wa.me/5511999999999?text=',
    );
    expect(buildOrderWhatsAppUrl(order)).toContain('Maria%20Silva');
  });
});
