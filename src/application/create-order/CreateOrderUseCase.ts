import type { OrderRepository } from '../repositories/OrderRepository';
import { Order, OrderProps } from '../../domain/order/Order';

export class CreateOrderUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(input: OrderProps): Promise<Order> {
    const order = Order.create(input);

    return this.orderRepository.save(order);
  }
}
