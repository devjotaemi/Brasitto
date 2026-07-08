import type { CartItem } from '../../domain/cart/Cart';
import { Order, OrderType } from '../../domain/order/Order';

export type CalculateOrderTotalInput = {
  type: OrderType;
  address?: string;
  items: CartItem[];
  deliveryFee?: number;
};

export type CalculatedOrderTotal = {
  subtotal: number;
  deliveryFee: number;
  total: number;
};

export class CalculateOrderTotalUseCase {
  execute(input: CalculateOrderTotalInput): CalculatedOrderTotal {
    return Order.calculateTotal({
      type: input.type,
      address: input.address,
      items: input.items,
      deliveryFee: input.deliveryFee,
    });
  }
}
