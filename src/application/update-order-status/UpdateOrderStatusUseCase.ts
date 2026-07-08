import type { OrderRepository } from '../repositories/OrderRepository';
import { Order, OrderStatus } from '../../domain/order/Order';

export type UpdateOrderStatusInput = {
  orderId: string;
  status: OrderStatus;
  cancellationReason?: string;
};

export class UpdateOrderStatusUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(input: UpdateOrderStatusInput): Promise<Order> {
    const order = await this.orderRepository.findById(input.orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    const cancellationReason = input.cancellationReason?.trim();

    if (input.status === OrderStatus.CANCELED && !cancellationReason) {
      throw new Error('Cancellation reason is required');
    }

    const finishedAt =
      input.status === OrderStatus.FINISHED ? new Date() : undefined;
    const updatedOrder = order.updateStatus(
      input.status,
      finishedAt,
      cancellationReason,
    );

    await this.orderRepository.updateStatus(
      input.orderId,
      input.status,
      finishedAt,
      cancellationReason,
    );

    return updatedOrder;
  }
}
