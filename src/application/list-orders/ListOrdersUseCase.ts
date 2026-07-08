import type {
  OrderListOptions,
  OrderRepository,
} from '../repositories/OrderRepository';
import type { Order } from '../../domain/order/Order';

export class ListOrdersUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(options?: OrderListOptions): Promise<Order[]> {
    return this.orderRepository.findAll(options);
  }
}
