import type { Order, OrderStatus } from '../../domain/order/Order';

export type OrderListOptions = {
  statuses?: OrderStatus[];
  limit?: number;
  offset?: number;
};

export interface OrderRepository {
  save(order: Order): Promise<Order>;
  findById(id: string): Promise<Order | null>;
  findByOrderNumberAndPhone(
    orderNumber: number,
    customerPhone: string,
  ): Promise<Order | null>;
  cancelByOrderNumberAndPhone?(
    orderNumber: number,
    customerPhone: string,
  ): Promise<Order>;
  findAll(options?: OrderListOptions): Promise<Order[]>;
  updateStatus(
    id: string,
    status: OrderStatus,
    finishedAt?: Date,
    cancellationReason?: string,
  ): Promise<void>;
  updateEstimatedReadyAt(
    id: string,
    estimatedReadyAt?: Date,
  ): Promise<void>;
}
