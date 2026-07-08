import type { Order } from '../../domain/order/Order';
import type { OrderRepository } from '../repositories/OrderRepository';

export type GetCustomerOrderStatusInput = {
  orderNumber: number;
  customerPhone: string;
};

export class GetCustomerOrderStatusUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(input: GetCustomerOrderStatusInput): Promise<Order | null> {
    if (!Number.isInteger(input.orderNumber) || input.orderNumber <= 0) {
      throw new Error('Order number must be a positive integer');
    }

    if (input.customerPhone.trim() === '') {
      throw new Error('Customer phone is required');
    }

    return this.orderRepository.findByOrderNumberAndPhone(
      input.orderNumber,
      input.customerPhone,
    );
  }
}
