import { describe, expect, it } from 'vitest';
import { CreateOrderUseCase } from '../../src/application/create-order/CreateOrderUseCase';
import { OrderRepository } from '../../src/application/repositories/OrderRepository';
import { CartItem } from '../../src/domain/cart/Cart';
import { Order, OrderStatus, OrderType } from '../../src/domain/order/Order';
import { Product } from '../../src/domain/product/Product';

class FakeOrderRepository implements OrderRepository {
  readonly orders: Order[] = [];

  async save(order: Order): Promise<Order> {
    this.orders.push(order);

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

  async updateStatus(id: string, status: OrderStatus): Promise<void> {
    const order = await this.findById(id);

    if (!order) {
      throw new Error('Order not found');
    }

    this.orders.splice(this.orders.indexOf(order), 1, order.updateStatus(status));
  }

  async updateEstimatedReadyAt(
    id: string,
    estimatedReadyAt?: Date,
  ): Promise<void> {
    const order = await this.findById(id);

    if (!order) {
      throw new Error('Order not found');
    }

    this.orders.splice(
      this.orders.indexOf(order),
      1,
      order.updateEstimatedReadyAt(estimatedReadyAt),
    );
  }
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

describe('CreateOrderUseCase', () => {
  it('deve criar e salvar um pedido de retirada', async () => {
    const repository = new FakeOrderRepository();
    const useCase = new CreateOrderUseCase(repository);

    const order = await useCase.execute({
      customerName: 'Maria Silva',
      customerPhone: '11999999999',
      type: OrderType.PICKUP,
      items,
    });

    expect(order.status).toBe(OrderStatus.PENDING);
    expect(order.deliveryFee).toBe(0);
    expect(order.total).toBe(100);
    expect(repository.orders).toEqual([order]);
  });

  it('deve criar e salvar um pedido de entrega com taxa fixa', async () => {
    const repository = new FakeOrderRepository();
    const useCase = new CreateOrderUseCase(repository);

    const order = await useCase.execute({
      customerName: 'Maria Silva',
      customerPhone: '11999999999',
      type: OrderType.DELIVERY,
      address: 'Rua dos Espetos, 123',
      items,
    });

    expect(order.deliveryFee).toBe(8);
    expect(order.total).toBe(108);
    expect(repository.orders).toEqual([order]);
  });

  it('nao deve salvar pedido invalido', async () => {
    const repository = new FakeOrderRepository();
    const useCase = new CreateOrderUseCase(repository);

    await expect(
      useCase.execute({
        customerName: 'Maria Silva',
        customerPhone: '11999999999',
        type: OrderType.DELIVERY,
        items,
      }),
    ).rejects.toThrow('Delivery order must have an address');

    expect(repository.orders).toEqual([]);
  });

  it('deve retornar pedido persistido pelo repositorio', async () => {
    class RepositoryWithGeneratedNumber extends FakeOrderRepository {
      async save(order: Order): Promise<Order> {
        const savedOrder = Order.create({
          id: order.id,
          orderNumber: 123,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          type: order.type,
          address: order.address,
          items: order.items,
          createdAt: order.createdAt,
          customerNote: order.customerNote,
        });

        this.orders.push(savedOrder);

        return savedOrder;
      }
    }
    const repository = new RepositoryWithGeneratedNumber();
    const useCase = new CreateOrderUseCase(repository);

    const order = await useCase.execute({
      customerName: 'Maria Silva',
      customerPhone: '11999999999',
      type: OrderType.PICKUP,
      items,
    });

    expect(order.orderNumber).toBe(123);
  });
});
