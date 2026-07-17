import type { CartItem } from '../cart/Cart';

export enum OrderType {
  DELIVERY = 'DELIVERY',
  PICKUP = 'PICKUP',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  IN_PREPARATION = 'IN_PREPARATION',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  READY_FOR_PICKUP = 'READY_FOR_PICKUP',
  FINISHED = 'FINISHED',
  CANCELED = 'CANCELED',
}

export type OrderProps = {
  id?: string;
  orderNumber?: number;
  customerName: string;
  customerPhone: string;
  type: OrderType;
  address?: string;
  items: CartItem[];
  deliveryFee?: number;
  deliveryRegion?: string;
  createdAt?: Date;
  finishedAt?: Date;
  customerNote?: string;
  estimatedReadyAt?: Date;
  cancellationReason?: string;
};

export type OrderTotalProps = {
  type: OrderType;
  address?: string;
  items: CartItem[];
  deliveryFee?: number;
};

export type OrderTotal = {
  subtotal: number;
  deliveryFee: number;
  total: number;
};

export class Order {
  private static readonly DELIVERY_FEE = 8;

  private constructor(
    public readonly id: string | undefined,
    public readonly orderNumber: number | undefined,
    public readonly customerName: string,
    public readonly customerPhone: string,
    public readonly type: OrderType,
    public readonly items: CartItem[],
    public readonly subtotal: number,
    public readonly deliveryFee: number,
    public readonly total: number,
    public readonly status: OrderStatus,
    public readonly address?: string,
    public readonly createdAt?: Date,
    public readonly finishedAt?: Date,
    public readonly customerNote?: string,
    public readonly estimatedReadyAt?: Date,
    public readonly cancellationReason?: string,
    public readonly deliveryRegion?: string,
  ) {}

  static create(props: OrderProps): Order {
    if (!props.customerName || !props.customerPhone) {
      throw new Error('Order must have customer name and phone');
    }

    if (props.items.length === 0) {
      throw new Error('Order must have at least one item');
    }

    const totals = Order.calculateTotal(props);

    return new Order(
      props.id,
      props.orderNumber,
      props.customerName,
      props.customerPhone,
      props.type,
      [...props.items],
      totals.subtotal,
      totals.deliveryFee,
      totals.total,
      OrderStatus.PENDING,
      props.address,
      props.createdAt,
      props.finishedAt,
      props.customerNote,
      props.estimatedReadyAt,
      props.cancellationReason,
      props.deliveryRegion,
    );
  }

  static calculateTotal(props: OrderTotalProps): OrderTotal {
    if (props.items.length === 0) {
      throw new Error('Order must have at least one item');
    }

    if (props.type === OrderType.DELIVERY && !props.address) {
      throw new Error('Delivery order must have an address');
    }

    const subtotal = props.items.reduce(
      (total, item) => total + item.totalPrice,
      0,
    );
    const deliveryFee =
      props.type === OrderType.DELIVERY
        ? props.deliveryFee ?? Order.DELIVERY_FEE
        : 0;

    return {
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee,
    };
  }

  updateStatus(
    status: OrderStatus,
    finishedAt?: Date,
    cancellationReason?: string,
  ): Order {
    return new Order(
      this.id,
      this.orderNumber,
      this.customerName,
      this.customerPhone,
      this.type,
      [...this.items],
      this.subtotal,
      this.deliveryFee,
      this.total,
      status,
      this.address,
      this.createdAt,
      status === OrderStatus.FINISHED
        ? finishedAt ?? this.finishedAt
        : this.finishedAt,
      this.customerNote,
      this.estimatedReadyAt,
      status === OrderStatus.CANCELED
        ? cancellationReason ?? this.cancellationReason
        : undefined,
      this.deliveryRegion,
    );
  }

  updateEstimatedReadyAt(estimatedReadyAt?: Date): Order {
    return new Order(
      this.id,
      this.orderNumber,
      this.customerName,
      this.customerPhone,
      this.type,
      [...this.items],
      this.subtotal,
      this.deliveryFee,
      this.total,
      this.status,
      this.address,
      this.createdAt,
      this.finishedAt,
      this.customerNote,
      estimatedReadyAt,
      this.cancellationReason,
      this.deliveryRegion,
    );
  }
}
