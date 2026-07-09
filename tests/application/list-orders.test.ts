import { describe, expect, it } from 'vitest';
import { ListOrdersUseCase } from '../../src/application/list-orders/ListOrdersUseCase';
import { OrderRepository } from '../../src/application/repositories/OrderRepository';
import { CartItem } from '../../src/domain/cart/Cart';
import { Order, OrderStatus, OrderType } from '../../src/domain/order/Order';
import { Product } from '../../src/domain/product/Product';

class FakeOrderRepository implements OrderRepository {
  constructor(private readonly orders: Order[]) {}

  async save(order: Order): Promise<Order> {
    return order;
  }

  async findById(id: string): Promise<Order | null> {
    return this.orders.find((order) => order.id === id) ?? null;
  }

  async findByOrderNumberAndPhone(
    orderNumber: number,
    customerPhone: string,
  ): Promise<Order | null> {
    const normalizedPhone = customerPhone.replace(/\D/g, '');

    return (
      this.orders.find(
        (order) =>
          order.orderNumber === orderNumber &&
          order.customerPhone.replace(/\D/g, '') === normalizedPhone,
      ) ?? null
    );
  }

  async findAll(): Promise<Order[]> {
    return this.orders;
  }

  async updateStatus(_id: string, _status: OrderStatus): Promise<void> {}

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
    quantity: 2,
    unitPrice: 50,
    totalPrice: 100,
  },
];

describe('ListOrdersUseCase', () => {
  it('deve listar pedidos recebidos', async () => {
    const order = Order.create({
      id: 'order-1',
      customerName: 'Maria Silva',
      customerPhone: '11999999999',
      type: OrderType.PICKUP,
      items,
    });
    const repository = new FakeOrderRepository([order]);
    const useCase = new ListOrdersUseCase(repository);

    await expect(useCase.execute()).resolves.toEqual([order]);
  });
});
