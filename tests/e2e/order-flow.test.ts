import { describe, expect, it } from 'vitest';
import { CreateOrderUseCase } from '../../src/application/create-order/CreateOrderUseCase';
import { GetCustomerOrderStatusUseCase } from '../../src/application/get-customer-order-status/GetCustomerOrderStatusUseCase';
import type { OrderRepository } from '../../src/application/repositories/OrderRepository';
import { UpdateOrderEstimateUseCase } from '../../src/application/update-order-estimate/UpdateOrderEstimateUseCase';
import { UpdateOrderStatusUseCase } from '../../src/application/update-order-status/UpdateOrderStatusUseCase';
import type { CartItem } from '../../src/domain/cart/Cart';
import { Order, OrderStatus, OrderType } from '../../src/domain/order/Order';
import { Product } from '../../src/domain/product/Product';

class FlowOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, Order>();
  private nextOrderNumber = 1;

  async save(order: Order): Promise<Order> {
    if (!order.id) {
      throw new Error('Order must have an id to be saved');
    }

    const savedOrder = Order.create({
      id: order.id,
      orderNumber: this.nextOrderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      type: order.type,
      address: order.address,
      items: order.items,
      deliveryFee: order.deliveryFee,
      createdAt: order.createdAt,
      customerNote: order.customerNote,
    });

    this.nextOrderNumber += 1;
    this.orders.set(order.id, savedOrder);

    return savedOrder;
  }

  async findById(id: string): Promise<Order | null> {
    return this.orders.get(id) ?? null;
  }

  async findByOrderNumberAndPhone(
    orderNumber: number,
    customerPhone: string,
  ): Promise<Order | null> {
    const normalizedPhone = customerPhone.replace(/\D/g, '');

    return (
      [...this.orders.values()].find(
        (order) =>
          order.orderNumber === orderNumber &&
          order.customerPhone.replace(/\D/g, '') === normalizedPhone,
      ) ?? null
    );
  }

  async findAll(): Promise<Order[]> {
    return [...this.orders.values()];
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    finishedAt?: Date,
    cancellationReason?: string,
  ): Promise<void> {
    const order = await this.findById(id);

    if (!order) {
      throw new Error('Order not found');
    }

    this.orders.set(
      id,
      order.updateStatus(status, finishedAt, cancellationReason),
    );
  }

  async updateEstimatedReadyAt(
    id: string,
    estimatedReadyAt?: Date,
  ): Promise<void> {
    const order = await this.findById(id);

    if (!order) {
      throw new Error('Order not found');
    }

    this.orders.set(id, order.updateEstimatedReadyAt(estimatedReadyAt));
  }
}

const product = Product.create({
  id: 'product-1',
  name: 'Torta de Frango',
  description: 'Torta salgada de frango com catupiry',
  price: 50,
  active: true,
});

const items: CartItem[] = [
  {
    product,
    quantity: 2,
    unitPrice: 50,
    totalPrice: 100,
  },
];

describe('Order flow', () => {
  it('cliente cria pedido, admin define previsao e cliente consulta status', async () => {
    const repository = new FlowOrderRepository();
    const createOrderUseCase = new CreateOrderUseCase(repository);
    const updateOrderEstimateUseCase = new UpdateOrderEstimateUseCase(
      repository,
    );
    const getCustomerOrderStatusUseCase = new GetCustomerOrderStatusUseCase(
      repository,
    );
    const estimatedReadyAt = new Date('2026-05-20T11:30:00.000Z');

    const createdOrder = await createOrderUseCase.execute({
      id: 'order-1',
      customerName: 'Maria Silva',
      customerPhone: '(11)99999-9999',
      type: OrderType.DELIVERY,
      address: 'Rua das Tortas, 123',
      customerNote: 'Entregar na portaria',
      deliveryFee: 12,
      items,
    });

    await updateOrderEstimateUseCase.execute({
      orderId: 'order-1',
      estimatedReadyAt,
    });

    const trackedOrder = await getCustomerOrderStatusUseCase.execute({
      orderNumber: createdOrder.orderNumber as number,
      customerPhone: '11999999999',
    });

    expect(trackedOrder?.customerNote).toBe('Entregar na portaria');
    expect(trackedOrder?.estimatedReadyAt).toEqual(estimatedReadyAt);
    expect(trackedOrder?.deliveryFee).toBe(12);
    expect(trackedOrder?.total).toBe(112);
  });

  it('admin cancela pedido com motivo e cliente visualiza o cancelamento', async () => {
    const repository = new FlowOrderRepository();
    const createOrderUseCase = new CreateOrderUseCase(repository);
    const updateOrderStatusUseCase = new UpdateOrderStatusUseCase(repository);
    const getCustomerOrderStatusUseCase = new GetCustomerOrderStatusUseCase(
      repository,
    );

    const createdOrder = await createOrderUseCase.execute({
      id: 'order-1',
      customerName: 'Maria Silva',
      customerPhone: '(11)99999-9999',
      type: OrderType.PICKUP,
      items,
    });

    await updateOrderStatusUseCase.execute({
      orderId: 'order-1',
      status: OrderStatus.CANCELED,
      cancellationReason: 'Produto indisponivel',
    });

    const trackedOrder = await getCustomerOrderStatusUseCase.execute({
      orderNumber: createdOrder.orderNumber as number,
      customerPhone: '11999999999',
    });

    expect(trackedOrder?.status).toBe(OrderStatus.CANCELED);
    expect(trackedOrder?.cancellationReason).toBe('Produto indisponivel');
  });
});
