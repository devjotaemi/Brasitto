import type { OrderRepository } from '../repositories/OrderRepository';
import type { Order } from '../../domain/order/Order';

export type UpdateOrderEstimateInput = {
  orderId: string;
  estimatedReadyAt?: Date;
};

export class UpdateOrderEstimateUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(input: UpdateOrderEstimateInput): Promise<Order> {
    const order = await this.orderRepository.findById(input.orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    const updatedOrder = order.updateEstimatedReadyAt(input.estimatedReadyAt);

    await this.orderRepository.updateEstimatedReadyAt(
      input.orderId,
      input.estimatedReadyAt,
    );

    return updatedOrder;
  }
}
