import { describe, expect, it } from 'vitest';
import { OrderRepository } from '../../src/application/repositories/OrderRepository';
import { UpdateOrderStatusUseCase } from '../../src/application/update-order-status/UpdateOrderStatusUseCase';
import { CartItem } from '../../src/domain/cart/Cart';
import { Order, OrderStatus, OrderType } from '../../src/domain/order/Order';
import { Product } from '../../src/domain/product/Product';

class FakeOrderRepository implements OrderRepository {
  readonly orders = new Map<string, Order>();
  updatedStatus: {
    id: string;
    status: OrderStatus;
    finishedAt?: Date;
    cancellationReason?: string;
  } | null = null;

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

  async save(order: Order): Promise<Order> {
    if (!order.id) {
      throw new Error('Order must have an id to be saved');
    }

    this.orders.set(order.id, order);

    return order;
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

    this.updatedStatus = { id, status, finishedAt, cancellationReason };
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

describe('UpdateOrderStatusUseCase', () => {
  it('deve atualizar e salvar o status de um pedido existente', async () => {
    const repository = new FakeOrderRepository();
    const order = Order.create({
      id: 'order-1',
      customerName: 'Maria Silva',
      customerPhone: '11999999999',
      type: OrderType.PICKUP,
      items,
    });
    await repository.save(order);

    const useCase = new UpdateOrderStatusUseCase(repository);

    const updatedOrder = await useCase.execute({
      orderId: 'order-1',
      status: OrderStatus.ACCEPTED,
    });

    expect(updatedOrder.status).toBe(OrderStatus.ACCEPTED);
    expect(repository.updatedStatus).toEqual({
      id: 'order-1',
      status: OrderStatus.ACCEPTED,
      finishedAt: undefined,
      cancellationReason: undefined,
    });
    expect(await repository.findById('order-1')).toEqual(updatedOrder);
  });

  it('deve registrar horario quando pedido for finalizado', async () => {
    const repository = new FakeOrderRepository();
    const order = Order.create({
      id: 'order-1',
      customerName: 'Maria Silva',
      customerPhone: '11999999999',
      type: OrderType.PICKUP,
      items,
    });
    await repository.save(order);

    const useCase = new UpdateOrderStatusUseCase(repository);

    const updatedOrder = await useCase.execute({
      orderId: 'order-1',
      status: OrderStatus.FINISHED,
    });

    expect(updatedOrder.finishedAt).toBeInstanceOf(Date);
    expect(repository.updatedStatus?.finishedAt).toEqual(
      updatedOrder.finishedAt,
    );
  });

  it('deve exigir e salvar motivo quando pedido for cancelado', async () => {
    const repository = new FakeOrderRepository();
    const order = Order.create({
      id: 'order-1',
      customerName: 'Maria Silva',
      customerPhone: '11999999999',
      type: OrderType.PICKUP,
      items,
    });
    await repository.save(order);

    const useCase = new UpdateOrderStatusUseCase(repository);

    const updatedOrder = await useCase.execute({
      orderId: 'order-1',
      status: OrderStatus.CANCELED,
      cancellationReason: 'Cliente pediu para cancelar',
    });

    expect(updatedOrder.cancellationReason).toBe(
      'Cliente pediu para cancelar',
    );
    expect(repository.updatedStatus).toEqual({
      id: 'order-1',
      status: OrderStatus.CANCELED,
      finishedAt: undefined,
      cancellationReason: 'Cliente pediu para cancelar',
    });
  });

  it('deve rejeitar cancelamento sem motivo', async () => {
    const repository = new FakeOrderRepository();
    const order = Order.create({
      id: 'order-1',
      customerName: 'Maria Silva',
      customerPhone: '11999999999',
      type: OrderType.PICKUP,
      items,
    });
    await repository.save(order);

    const useCase = new UpdateOrderStatusUseCase(repository);

    await expect(
      useCase.execute({
        orderId: 'order-1',
        status: OrderStatus.CANCELED,
        cancellationReason: '   ',
      }),
    ).rejects.toThrow('Cancellation reason is required');
  });

  it('deve falhar quando pedido nao existir', async () => {
    const repository = new FakeOrderRepository();
    const useCase = new UpdateOrderStatusUseCase(repository);

    await expect(
      useCase.execute({
        orderId: 'missing-order',
        status: OrderStatus.ACCEPTED,
      }),
    ).rejects.toThrow('Order not found');
  });
});
