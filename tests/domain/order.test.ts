import { describe, expect, it } from 'vitest';
import { Order, OrderStatus, OrderType } from '../../src/domain/order/Order';
import { Product } from '../../src/domain/product/Product';

const product = Product.create({
  name: 'Espeto de Carne',
  description: 'Espeto bovino assado na brasa',
  price: 50,
  active: true,
});

const orderItems = [
  {
    product,
    quantity: 2,
    unitPrice: 50,
    totalPrice: 100,
  },
];

describe('Order', () => {
  it('pedido do tipo RETIRADA nao deve cobrar taxa de entrega', () => {
    const order = Order.create({
      customerName: 'Maria Silva',
      customerPhone: '11999999999',
      type: OrderType.PICKUP,
      items: orderItems,
    });

    expect(order.subtotal).toBe(100);
    expect(order.deliveryFee).toBe(0);
    expect(order.total).toBe(100);
  });

  it('pedido do tipo ENTREGA deve cobrar taxa de entrega fixa de R$ 8,00', () => {
    const order = Order.create({
      customerName: 'Maria Silva',
      customerPhone: '11999999999',
      type: OrderType.DELIVERY,
      address: 'Rua dos Espetos, 123',
      items: orderItems,
    });

    expect(order.subtotal).toBe(100);
    expect(order.deliveryFee).toBe(8);
    expect(order.total).toBe(108);
  });

  it('pedido do tipo ENTREGA pode usar taxa de entrega configurada', () => {
    const order = Order.create({
      customerName: 'Maria Silva',
      customerPhone: '11999999999',
      type: OrderType.DELIVERY,
      address: 'Rua dos Espetos, 123',
      deliveryFee: 12,
      items: orderItems,
    });

    expect(order.subtotal).toBe(100);
    expect(order.deliveryFee).toBe(12);
    expect(order.total).toBe(112);
  });

  it('pedido do tipo ENTREGA deve exigir endereco', () => {
    expect(() =>
      Order.create({
        customerName: 'Maria Silva',
        customerPhone: '11999999999',
        type: OrderType.DELIVERY,
        items: orderItems,
      }),
    ).toThrow('Delivery order must have an address');
  });

  it('pedido do tipo RETIRADA nao deve exigir endereco', () => {
    const order = Order.create({
      customerName: 'Maria Silva',
      customerPhone: '11999999999',
      type: OrderType.PICKUP,
      items: orderItems,
    });

    expect(order.address).toBeUndefined();
  });

  it('pedido deve iniciar com status PENDENTE', () => {
    const order = Order.create({
      id: 'order-1',
      customerName: 'Maria Silva',
      customerPhone: '11999999999',
      type: OrderType.PICKUP,
      items: orderItems,
    });

    expect(order.id).toBe('order-1');
    expect(order.status).toBe(OrderStatus.PENDING);
  });

  it('deve atualizar status do pedido', () => {
    const order = Order.create({
      id: 'order-1',
      customerName: 'Maria Silva',
      customerPhone: '11999999999',
      type: OrderType.PICKUP,
      items: orderItems,
    });

    const updatedOrder = order.updateStatus(OrderStatus.ACCEPTED);

    expect(updatedOrder.id).toBe('order-1');
    expect(updatedOrder.status).toBe(OrderStatus.ACCEPTED);
    expect(updatedOrder.total).toBe(100);
  });

  it('deve preservar horario de criacao ao atualizar status', () => {
    const createdAt = new Date('2026-05-20T10:30:00.000Z');
    const order = Order.create({
      id: 'order-1',
      customerName: 'Maria Silva',
      customerPhone: '11999999999',
      type: OrderType.PICKUP,
      items: orderItems,
      createdAt,
    });

    const updatedOrder = order.updateStatus(OrderStatus.ACCEPTED);

    expect(updatedOrder.createdAt).toEqual(createdAt);
  });

  it('deve armazenar horario de finalizacao ao finalizar pedido', () => {
    const finishedAt = new Date('2026-05-20T12:00:00.000Z');
    const order = Order.create({
      id: 'order-1',
      customerName: 'Maria Silva',
      customerPhone: '11999999999',
      type: OrderType.PICKUP,
      items: orderItems,
    });

    const updatedOrder = order.updateStatus(OrderStatus.FINISHED, finishedAt);

    expect(updatedOrder.status).toBe(OrderStatus.FINISHED);
    expect(updatedOrder.finishedAt).toEqual(finishedAt);
  });

  it('deve armazenar motivo ao cancelar pedido', () => {
    const order = Order.create({
      id: 'order-1',
      customerName: 'Maria Silva',
      customerPhone: '11999999999',
      type: OrderType.PICKUP,
      items: orderItems,
    });

    const updatedOrder = order.updateStatus(
      OrderStatus.CANCELED,
      undefined,
      'Cliente desistiu do pedido',
    );

    expect(updatedOrder.status).toBe(OrderStatus.CANCELED);
    expect(updatedOrder.cancellationReason).toBe(
      'Cliente desistiu do pedido',
    );
  });

  it('deve armazenar observacao e previsao do pedido', () => {
    const estimatedReadyAt = new Date('2026-05-20T11:30:00.000Z');
    const order = Order.create({
      id: 'order-1',
      customerName: 'Maria Silva',
      customerPhone: '11999999999',
      type: OrderType.PICKUP,
      items: orderItems,
      customerNote: 'Sem cebola',
      estimatedReadyAt,
    });

    expect(order.customerNote).toBe('Sem cebola');
    expect(order.estimatedReadyAt).toEqual(estimatedReadyAt);
  });

  it('deve atualizar previsao do pedido', () => {
    const estimatedReadyAt = new Date('2026-05-20T11:30:00.000Z');
    const order = Order.create({
      id: 'order-1',
      customerName: 'Maria Silva',
      customerPhone: '11999999999',
      type: OrderType.PICKUP,
      items: orderItems,
    });

    const updatedOrder = order.updateEstimatedReadyAt(estimatedReadyAt);

    expect(updatedOrder.estimatedReadyAt).toEqual(estimatedReadyAt);
  });

  it('deve iniciar sem horario de criacao quando nao informado', () => {
    const order = Order.create({
      id: 'order-1',
      customerName: 'Maria Silva',
      customerPhone: '11999999999',
      type: OrderType.PICKUP,
      items: orderItems,
    });

    expect(order.createdAt).toBeUndefined();
  });

  it('deve armazenar numero sequencial quando informado', () => {
    const order = Order.create({
      id: 'order-1',
      orderNumber: 123,
      customerName: 'Maria Silva',
      customerPhone: '11999999999',
      type: OrderType.PICKUP,
      items: orderItems,
    });

    expect(order.orderNumber).toBe(123);
  });

  it('pedido deve exigir nome e telefone do cliente', () => {
    expect(() =>
      Order.create({
        customerName: '',
        customerPhone: '11999999999',
        type: OrderType.PICKUP,
        items: orderItems,
      }),
    ).toThrow('Order must have customer name and phone');

    expect(() =>
      Order.create({
        customerName: 'Maria Silva',
        customerPhone: '',
        type: OrderType.PICKUP,
        items: orderItems,
      }),
    ).toThrow('Order must have customer name and phone');
  });

  it('pedido nao pode ser criado sem itens', () => {
    expect(() =>
      Order.create({
        customerName: 'Maria Silva',
        customerPhone: '11999999999',
        type: OrderType.PICKUP,
        items: [],
      }),
    ).toThrow('Order must have at least one item');
  });
});
