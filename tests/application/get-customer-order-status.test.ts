import { describe, expect, it } from 'vitest';
import { GetCustomerOrderStatusUseCase } from '../../src/application/get-customer-order-status/GetCustomerOrderStatusUseCase';
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

describe('GetCustomerOrderStatusUseCase', () => {
  it('deve consultar pedido por numero e telefone', async () => {
    const order = Order.create({
      id: 'order-1',
      orderNumber: 123,
      customerName: 'Maria Silva',
      customerPhone: '(11)99999-9999',
      type: OrderType.PICKUP,
      items,
    }).updateStatus(OrderStatus.IN_PREPARATION);
    const useCase = new GetCustomerOrderStatusUseCase(
      new FakeOrderRepository([order]),
    );

    await expect(
      useCase.execute({
        orderNumber: 123,
        customerPhone: '11999999999',
      }),
    ).resolves.toEqual(order);
  });

  it('deve retornar null quando numero e telefone nao conferem', async () => {
    const order = Order.create({
      id: 'order-1',
      orderNumber: 123,
      customerName: 'Maria Silva',
      customerPhone: '11999999999',
      type: OrderType.PICKUP,
      items,
    });
    const useCase = new GetCustomerOrderStatusUseCase(
      new FakeOrderRepository([order]),
    );

    await expect(
      useCase.execute({
        orderNumber: 123,
        customerPhone: '11888888888',
      }),
    ).resolves.toBeNull();
  });

  it('deve validar numero do pedido', async () => {
    const useCase = new GetCustomerOrderStatusUseCase(
      new FakeOrderRepository([]),
    );

    await expect(
      useCase.execute({
        orderNumber: 0,
        customerPhone: '11999999999',
      }),
    ).rejects.toThrow('Order number must be a positive integer');
  });
});
