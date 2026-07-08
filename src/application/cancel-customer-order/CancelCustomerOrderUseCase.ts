import type { OrderRepository } from '../repositories/OrderRepository';
import { OrderStatus } from '../../domain/order/Order';

export type CancelCustomerOrderInput = {
  orderNumber: number;
  customerPhone: string;
};

export class CancelCustomerOrderUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(input: CancelCustomerOrderInput) {
    if (!Number.isInteger(input.orderNumber) || input.orderNumber <= 0) {
      throw new Error('Order number must be a positive integer');
    }

    if (!input.customerPhone.trim()) {
      throw new Error('Customer phone is required');
    }

    const order = await this.orderRepository.findByOrderNumberAndPhone(
      input.orderNumber,
      input.customerPhone,
    );

    if (!order) {
      throw new Error('Customer order not found');
    }

    if (
      order.status !== OrderStatus.PENDING &&
      order.status !== OrderStatus.ACCEPTED
    ) {
      throw new Error('Customer order cannot be canceled');
    }

    if (!this.orderRepository.cancelByOrderNumberAndPhone) {
      throw new Error('Customer order cancellation is not available');
    }

    return this.orderRepository.cancelByOrderNumberAndPhone(
      input.orderNumber,
      input.customerPhone,
    );
  }
}
