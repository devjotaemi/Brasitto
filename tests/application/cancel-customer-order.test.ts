import { describe, expect, it } from 'vitest';
import { CancelCustomerOrderUseCase } from '../../src/application/cancel-customer-order/CancelCustomerOrderUseCase';
import type { OrderRepository } from '../../src/application/repositories/OrderRepository';
import type { CartItem } from '../../src/domain/cart/Cart';
import { Order, OrderStatus, OrderType } from '../../src/domain/order/Order';
import { Product } from '../../src/domain/product/Product';

class FakeOrderRepository implements OrderRepository {
  canceledInput:
    | {
        orderNumber: number;
        customerPhone: string;
      }
    | null = null;

  constructor(private readonly order: Order | null) {}

  async save(order: Order): Promise<Order> {
    return order;
  }

  async findById(): Promise<Order | null> {
    return this.order;
  }

  async findByOrderNumberAndPhone(): Promise<Order | null> {
    return this.order;
  }

  async cancelByOrderNumberAndPhone(
    orderNumber: number,
    customerPhone: string,
  ): Promise<Order> {
    this.canceledInput = { orderNumber, customerPhone };

    if (!this.order) {
      throw new Error('Customer order not found');
    }

    return this.order.updateStatus(
      OrderStatus.CANCELED,
      undefined,
      'Cancelado pelo cliente',
    );
  }

  async findAll(): Promise<Order[]> {
    return this.order ? [this.order] : [];
  }

  async updateStatus(): Promise<void> {}

  async updateEstimatedReadyAt(): Promise<void> {}
}

const product = Product.create({
  name: 'Espeto de Carne',
  description: 'Espeto bovino assado na brasa',
  price: 50,
  active: true,
});

const items: CartItem[] = [
  {
    product,
    quantity: 1,
    unitPrice: 50,
    totalPrice: 50,
  },
];

const createOrder = (status: OrderStatus) =>
  Order.create({
    id: 'order-1',
    orderNumber: 123,
    customerName: 'Maria Silva',
    customerPhone: '11999999999',
    type: OrderType.PICKUP,
    items,
  }).updateStatus(status);

describe('CancelCustomerOrderUseCase', () => {
  it('deve cancelar pedido pendente por numero e telefone', async () => {
    const repository = new FakeOrderRepository(
      createOrder(OrderStatus.PENDING),
    );
    const useCase = new CancelCustomerOrderUseCase(repository);

    const canceledOrder = await useCase.execute({
      orderNumber: 123,
      customerPhone: '11999999999',
    });

    expect(canceledOrder.status).toBe(OrderStatus.CANCELED);
    expect(canceledOrder.cancellationReason).toBe('Cancelado pelo cliente');
    expect(repository.canceledInput).toEqual({
      orderNumber: 123,
      customerPhone: '11999999999',
    });
  });

  it('deve rejeitar cancelamento quando pedido ja entrou em preparo', async () => {
    const repository = new FakeOrderRepository(
      createOrder(OrderStatus.IN_PREPARATION),
    );
    const useCase = new CancelCustomerOrderUseCase(repository);

    await expect(
      useCase.execute({
        orderNumber: 123,
        customerPhone: '11999999999',
      }),
    ).rejects.toThrow('Customer order cannot be canceled');
    expect(repository.canceledInput).toBeNull();
  });

  it('deve validar numero do pedido', async () => {
    const useCase = new CancelCustomerOrderUseCase(
      new FakeOrderRepository(null),
    );

    await expect(
      useCase.execute({
        orderNumber: 0,
        customerPhone: '11999999999',
      }),
    ).rejects.toThrow('Order number must be a positive integer');
  });
});
