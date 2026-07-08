import type { OrderRepository } from '../../application/repositories/OrderRepository';
import type { OrderListOptions } from '../../application/repositories/OrderRepository';
import type { CartItem } from '../../domain/cart/Cart';
import { Order, OrderStatus, OrderType } from '../../domain/order/Order';
import { Product } from '../../domain/product/Product';

type SupabaseQueryResult<T = unknown> = {
  data?: T;
  error?: Error | null;
};

type SupabaseClient = {
  from(table: string): unknown;
  rpc?: (functionName: string, params: Record<string, unknown>) => unknown;
};

type OrderRow = {
  id: string;
  order_number?: number | null;
  customer_name: string;
  customer_phone: string;
  customer_phone_normalized?: string | null;
  order_type: OrderType;
  address?: string | null;
  subtotal?: number | null;
  delivery_fee?: number | null;
  total?: number | null;
  status: OrderStatus;
  created_at?: string | null;
  finished_at?: string | null;
  customer_note?: string | null;
  estimated_ready_at?: string | null;
  cancellation_reason?: string | null;
};

type OrderItemRow = {
  order_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

type CustomerOrderStatusRow = OrderRow & {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

type CreatedOrderRow = CustomerOrderStatusRow;

export class SupabaseOrderRepository implements OrderRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async save(order: Order): Promise<Order> {
    if (!order.id) {
      throw new Error('Order must have an id to be saved');
    }

    if (this.supabase.rpc) {
      const result = (await this.supabase.rpc('create_order_with_items', {
        p_id: order.id,
        p_customer_name: order.customerName,
        p_customer_phone: order.customerPhone,
        p_order_type: order.type,
        p_address: order.address ?? null,
        p_customer_note: order.customerNote ?? null,
        p_items: this.toCreateOrderItemRows(order),
      })) as SupabaseQueryResult<unknown>;

      this.throwIfSupabaseError(result);

      const rows = (Array.isArray(result.data)
        ? result.data
        : result.data
          ? [result.data]
          : []) as CreatedOrderRow[];

      if (rows.length === 0) {
        throw new Error('Could not create order');
      }

      return this.toDomain(rows[0], rows.map((row) => this.toOrderItemRow(row)));
    }

    return this.saveWithSeparateInserts(order);
  }

  async findById(id: string): Promise<Order | null> {
    const ordersTable = this.supabase.from('orders') as {
      select: (columns?: string) => {
        eq: (
          field: string,
          value: string,
        ) => {
          maybeSingle: () => Promise<SupabaseQueryResult<unknown | null>>;
        };
      };
    };
    const orderItemsTable = this.supabase.from('order_items') as {
      select: (columns?: string) => {
        eq: (
          field: string,
          value: string,
        ) => Promise<SupabaseQueryResult<unknown[]>>;
      };
    };

    const orderResult = await ordersTable
      .select('*')
      .eq('id', id)
      .maybeSingle();

    this.throwIfSupabaseError(orderResult);

    if (!orderResult.data) {
      return null;
    }

    const itemsResult = await orderItemsTable
      .select('*')
      .eq('order_id', id);

    return this.toDomain(
      orderResult.data as OrderRow,
      (itemsResult.data ?? []) as OrderItemRow[],
    );
  }

  async findByOrderNumberAndPhone(
    orderNumber: number,
    customerPhone: string,
  ): Promise<Order | null> {
    if (!this.supabase.rpc) {
      return null;
    }

    const result = (await this.supabase.rpc('get_customer_order_status', {
      p_order_number: orderNumber,
      p_customer_phone: customerPhone,
    })) as SupabaseQueryResult<unknown[]>;

    this.throwIfSupabaseError(result);

    const rows = (result.data ?? []) as CustomerOrderStatusRow[];

    if (rows.length === 0) {
      return null;
    }

    return this.toDomain(rows[0], rows.map((row) => this.toOrderItemRow(row)));
  }

  async cancelByOrderNumberAndPhone(
    orderNumber: number,
    customerPhone: string,
  ): Promise<Order> {
    if (!this.supabase.rpc) {
      throw new Error('Supabase RPC is not available');
    }

    const result = (await this.supabase.rpc('cancel_customer_order', {
      p_order_number: orderNumber,
      p_customer_phone: customerPhone,
    })) as SupabaseQueryResult<unknown[]>;

    this.throwIfSupabaseError(result);

    const rows = (result.data ?? []) as CustomerOrderStatusRow[];

    if (rows.length === 0) {
      throw new Error('Customer order not found');
    }

    return this.toDomain(rows[0], rows.map((row) => this.toOrderItemRow(row)));
  }

  async findAll(options: OrderListOptions = {}): Promise<Order[]> {
    const ordersTable = this.supabase.from('orders') as {
      select: (columns?: string) => {
        in: (
          column: string,
          values: string[],
        ) => {
          order: (
            column: string,
            options: { ascending: boolean },
          ) => {
            range: (
              from: number,
              to: number,
            ) => Promise<SupabaseQueryResult<unknown[]>>;
          } & Promise<SupabaseQueryResult<unknown[]>>;
        };
        order: (
          column: string,
          options: { ascending: boolean },
        ) => {
          range: (
            from: number,
            to: number,
          ) => Promise<SupabaseQueryResult<unknown[]>>;
        } & Promise<SupabaseQueryResult<unknown[]>>;
      };
    };
    const orderItemsTable = this.supabase.from('order_items') as {
      select: (columns?: string) => {
        in: (
          column: string,
          values: string[],
        ) => Promise<SupabaseQueryResult<unknown[]>>;
      } & Promise<SupabaseQueryResult<unknown[]>>;
    };

    const ordersQuery = options.statuses?.length
      ? ordersTable
          .select('*')
          .in('status', options.statuses)
          .order('created_at', { ascending: false })
      : ordersTable.select('*').order('created_at', { ascending: false });

    const ordersResult =
      options.limit !== undefined
        ? await ordersQuery.range(
            options.offset ?? 0,
            (options.offset ?? 0) + options.limit - 1,
          )
        : await ordersQuery;

    this.throwIfSupabaseError(ordersResult);

    const orderRows = (ordersResult.data ?? []) as OrderRow[];

    if (orderRows.length === 0) {
      return [];
    }

    const orderIds = orderRows.flatMap((orderRow) =>
      orderRow.id ? [orderRow.id] : [],
    );

    const itemsResult = await orderItemsTable
      .select('*')
      .in('order_id', orderIds);

    this.throwIfSupabaseError(itemsResult);

    const itemRows = (itemsResult.data ?? []) as OrderItemRow[];

    return orderRows.map((orderRow) =>
      this.toDomain(
        orderRow,
        itemRows.filter((itemRow) => itemRow.order_id === orderRow.id),
      ),
    );
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    finishedAt?: Date,
    cancellationReason?: string,
  ): Promise<void> {
    const ordersTable = this.supabase.from('orders') as {
      update: (row: unknown) => {
        eq: (
          field: string,
          value: string,
        ) => Promise<SupabaseQueryResult>;
      };
    };

    const row =
      status === OrderStatus.FINISHED
        ? {
            status,
            finished_at: finishedAt?.toISOString() ?? new Date().toISOString(),
            cancellation_reason: null,
          }
        : status === OrderStatus.CANCELED
          ? {
              status,
              cancellation_reason: cancellationReason,
            }
          : {
              status,
              cancellation_reason: null,
            };

    const result = await ordersTable.update(row).eq('id', id);

    this.throwIfSupabaseError(result);
  }

  async updateEstimatedReadyAt(
    id: string,
    estimatedReadyAt?: Date,
  ): Promise<void> {
    const ordersTable = this.supabase.from('orders') as {
      update: (row: unknown) => {
        eq: (
          field: string,
          value: string,
        ) => Promise<SupabaseQueryResult>;
      };
    };

    const result = await ordersTable
      .update({
        estimated_ready_at: estimatedReadyAt?.toISOString() ?? null,
      })
      .eq('id', id);

    this.throwIfSupabaseError(result);
  }

  private toDomain(orderRow: OrderRow, itemRows: OrderItemRow[]): Order {
    const order = Order.create({
      id: orderRow.id,
      orderNumber: orderRow.order_number ?? undefined,
      customerName: orderRow.customer_name,
      customerPhone: orderRow.customer_phone,
      type: orderRow.order_type,
      address: orderRow.address ?? undefined,
      items: itemRows.map((row) => this.toCartItem(row)),
      deliveryFee: Number(orderRow.delivery_fee ?? 8),
      createdAt: orderRow.created_at
        ? new Date(orderRow.created_at)
        : undefined,
      finishedAt: orderRow.finished_at
        ? new Date(orderRow.finished_at)
        : undefined,
      customerNote: orderRow.customer_note ?? undefined,
      estimatedReadyAt: orderRow.estimated_ready_at
        ? new Date(orderRow.estimated_ready_at)
        : undefined,
      cancellationReason: orderRow.cancellation_reason ?? undefined,
    });

    return order.updateStatus(
      orderRow.status,
      order.finishedAt,
      order.cancellationReason,
    );
  }

  private toCartItem(row: OrderItemRow): CartItem {
    const product = Product.create({
      name: row.product_name,
      description: row.product_name,
      price: row.unit_price,
      active: true,
    });

    return {
      product,
      quantity: row.quantity,
      unitPrice: row.unit_price,
      totalPrice: row.total_price,
    };
  }

  private toOrderItemRow(row: CustomerOrderStatusRow): OrderItemRow {
    return {
      order_id: row.id,
      product_name: row.product_name,
      quantity: row.quantity,
      unit_price: row.unit_price,
      total_price: row.total_price,
    };
  }

  private toOrderItemRows(order: Order): OrderItemRow[] {
    if (!order.id) {
      return [];
    }

    return order.items.map((item) => ({
      order_id: order.id as string,
      product_name: item.product.name,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.totalPrice,
    }));
  }

  private toCreateOrderItemRows(order: Order): Array<{
    product_id: string;
    quantity: number;
  }> {
    return order.items.map((item) => {
      if (!item.product.id) {
        throw new Error('Product must have an id to create an order');
      }

      return {
        product_id: item.product.id,
        quantity: item.quantity,
      };
    });
  }

  private async saveWithSeparateInserts(order: Order): Promise<Order> {
    const ordersTable = this.supabase.from('orders') as {
      insert: (row: unknown) => Promise<SupabaseQueryResult>;
    };
    const orderItemsTable = this.supabase.from('order_items') as {
      insert: (rows: unknown[]) => Promise<SupabaseQueryResult>;
    };

    const orderResult = await ordersTable.insert({
      id: order.id,
      customer_name: order.customerName,
      customer_phone: order.customerPhone,
      customer_phone_normalized: this.normalizePhone(order.customerPhone),
      order_type: order.type,
      address: order.address,
      customer_note: order.customerNote,
      estimated_ready_at: order.estimatedReadyAt?.toISOString(),
      subtotal: order.subtotal,
      delivery_fee: order.deliveryFee,
      total: order.total,
      status: order.status,
    });

    this.throwIfSupabaseError(orderResult);

    const itemsResult = await orderItemsTable.insert(
      this.toOrderItemRows(order).map((item) => ({
        order_id: item.order_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
      })),
    );

    this.throwIfSupabaseError(itemsResult);

    return order;
  }

  private throwIfSupabaseError(result?: SupabaseQueryResult): void {
    if (result?.error) {
      throw result.error;
    }
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }
}
