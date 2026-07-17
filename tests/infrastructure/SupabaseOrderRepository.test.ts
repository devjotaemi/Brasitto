import { describe, expect, it } from 'vitest';
import { SupabaseOrderRepository } from '../../src/infrastructure/repositories/SupabaseOrderRepository';
import { CartItem } from '../../src/domain/cart/Cart';
import { Order, OrderStatus, OrderType } from '../../src/domain/order/Order';
import { Product } from '../../src/domain/product/Product';

type QueryResult = {
  data?: unknown;
  error?: Error | null;
};

class FakeSupabaseClient {
  readonly savedOrders: unknown[] = [];
  readonly savedOrderItems: unknown[] = [];
  readonly updatedOrders: unknown[] = [];
  readonly rpcCalls: Array<{
    functionName: string;
    params: Record<string, unknown>;
  }> = [];
  customerOrderStatusRows: unknown[] = [];
  orderRow: unknown = null;
  orderRows: unknown[] = [];
  orderItemRows: unknown[] = [];
  createOrderError: Error | null = null;

  async rpc(functionName: string, params: Record<string, unknown>): Promise<QueryResult> {
    this.rpcCalls.push({ functionName, params });

    if (functionName === 'get_customer_order_status') {
      return {
        data: this.customerOrderStatusRows,
        error: null,
      };
    }

    if (functionName === 'cancel_customer_order') {
      return {
        data: this.customerOrderStatusRows.map((row) => ({
          ...(row as Record<string, unknown>),
          status: 'CANCELED',
          cancellation_reason: 'Cancelado pelo cliente',
        })),
        error: null,
      };
    }

    if (functionName !== 'create_order_with_items') {
      throw new Error(`Unexpected function: ${functionName}`);
    }

    if (this.createOrderError) {
      return {
        error: this.createOrderError,
      };
    }

    this.savedOrders.push({
      id: params.p_id,
      customer_name: params.p_customer_name,
      customer_phone: params.p_customer_phone,
      order_type: params.p_order_type,
      address: params.p_address,
      customer_note: params.p_customer_note,
    });
    const itemRows = (params.p_items as Record<string, unknown>[]).map(
      (item) => ({
        order_id: params.p_id,
        product_id: item.product_id,
        product_name: 'Espeto de Carne',
        quantity: item.quantity,
        unit_price: 50,
        total_price: 100,
      }),
    );
    this.savedOrderItems.push(...itemRows);

    return {
      data: itemRows.map((itemRow) => ({
        id: params.p_id,
        customer_name: params.p_customer_name,
        customer_phone: params.p_customer_phone,
        order_type: params.p_order_type,
        address: params.p_address,
        status: 'PENDING',
        order_number: 123,
        created_at: '2026-05-20T10:30:00.000Z',
        finished_at: null,
        customer_note: params.p_customer_note,
        estimated_ready_at: null,
        delivery_fee: 8,
        cancellation_reason: null,
        product_name: itemRow.product_name,
        quantity: itemRow.quantity,
        unit_price: itemRow.unit_price,
        total_price: itemRow.total_price,
      })),
      error: null,
    };
  }

  from(table: string) {
    if (table === 'orders') {
      return {
        insert: (row: unknown) => {
          this.savedOrders.push(row);
          const result: QueryResult = {
            data: {
              ...(row as Record<string, unknown>),
              order_number: 123,
              created_at: '2026-05-20T10:30:00.000Z',
            },
            error: null,
          };

          return {
            select: () => ({
              single: async (): Promise<QueryResult> => result,
            }),
          };
        },
        update: (row: unknown) => ({
          eq: async (_field: string, id: string): Promise<QueryResult> => {
            this.updatedOrders.push({ id, row });
            return { error: null };
          },
        }),
        select: () => {
          const createOrderListResult = (rows: unknown[]) => {
            const result = Promise.resolve({
              data: rows,
              error: null,
            });

            return Object.assign(result, {
              range: async (from: number, to: number): Promise<QueryResult> => ({
                data: rows.slice(from, to + 1),
                error: null,
              }),
            });
          };

          return {
            in: (_field: string, values: string[]) => ({
              order: () =>
                createOrderListResult(
                  this.orderRows.filter((row) =>
                    values.includes((row as { status: string }).status),
                  ),
                ),
            }),
            order: () => createOrderListResult(this.orderRows),
            eq: (_field: string, id: string) => ({
              maybeSingle: async (): Promise<QueryResult> => ({
                data:
                  this.orderRow &&
                  (this.orderRow as { id: string }).id === id
                    ? this.orderRow
                    : null,
                error: null,
              }),
            }),
          };
        },
      };
    }

    if (table === 'order_items') {
      return {
        insert: async (rows: unknown[]): Promise<QueryResult> => {
          this.savedOrderItems.push(...rows);
          return { error: null };
        },
        select: () => {
          const result = Promise.resolve({
            data: this.orderItemRows,
            error: null,
          });

          return Object.assign(result, {
            in: async (
              _field: string,
              orderIds: string[],
            ): Promise<QueryResult> => ({
              data: this.orderItemRows.filter((row) =>
                orderIds.includes((row as { order_id: string }).order_id),
              ),
              error: null,
            }),
            eq: async (
              _field: string,
              orderId: string,
            ): Promise<QueryResult> => ({
              data: this.orderItemRows.filter(
                (row) => (row as { order_id: string }).order_id === orderId,
              ),
              error: null,
            }),
          });
        },
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  }
}

const product = Product.create({
  id: 'product-1',
  name: 'Espeto de Carne',
  description: 'Espeto bovino assado na brasa',
  price: 50,
  active: true,
});

const items: CartItem[] = [
  {
    product,
    quantity: 2,
    unitPrice: 50,
    totalPrice: 100,
  },
];

describe('SupabaseOrderRepository', () => {
  it('deve salvar pedido e itens no formato esperado pelo Supabase', async () => {
    const client = new FakeSupabaseClient();
    const repository = new SupabaseOrderRepository(client);
    const order = Order.create({
      id: 'order-1',
      customerName: 'Maria Silva',
      customerPhone: '11999999999',
      type: OrderType.DELIVERY,
      address: 'Rua dos Espetos, 123',
      items,
    });

    const savedOrder = await repository.save(order);

    expect(client.savedOrders).toEqual([
      {
        id: 'order-1',
        customer_name: 'Maria Silva',
        customer_phone: '11999999999',
        order_type: 'DELIVERY',
        address: 'Rua dos Espetos, 123',
        customer_note: null,
      },
    ]);
    expect(client.rpcCalls[0]).toEqual({
      functionName: 'create_order_with_items',
      params: {
        p_id: 'order-1',
        p_customer_name: 'Maria Silva',
        p_customer_phone: '11999999999',
        p_order_type: 'DELIVERY',
        p_address: 'Rua dos Espetos, 123',
        p_customer_note: null,
        p_delivery_region: null,
        p_items: [
          {
            product_id: 'product-1',
            quantity: 2,
          },
        ],
      },
    });
    expect(savedOrder.orderNumber).toBe(123);
    expect(savedOrder.createdAt).toEqual(
      new Date('2026-05-20T10:30:00.000Z'),
    );
    expect(client.savedOrderItems).toEqual([
      {
        order_id: 'order-1',
        product_id: 'product-1',
        product_name: 'Espeto de Carne',
        quantity: 2,
        unit_price: 50,
        total_price: 100,
      },
    ]);
  });

  it('deve propagar erro quando cliente ja tem pedido ativo', async () => {
    const client = new FakeSupabaseClient();
    client.createOrderError = new Error('Customer already has an active order');
    const repository = new SupabaseOrderRepository(client);
    const order = Order.create({
      id: 'order-1',
      customerName: 'Maria Silva',
      customerPhone: '11999999999',
      type: OrderType.PICKUP,
      items,
    });

    await expect(repository.save(order)).rejects.toThrow(
      'Customer already has an active order',
    );
    expect(client.savedOrders).toEqual([]);
    expect(client.savedOrderItems).toEqual([]);
  });

  it('deve buscar pedido por id e reconstruir o dominio', async () => {
    const client = new FakeSupabaseClient();
    client.orderRow = {
      id: 'order-1',
      customer_name: 'Maria Silva',
      customer_phone: '11999999999',
      order_type: 'DELIVERY',
      address: 'Rua dos Espetos, 123',
      status: 'ACCEPTED',
      created_at: '2026-05-20T10:30:00.000Z',
      finished_at: '2026-05-20T12:00:00.000Z',
      customer_note: 'Sem cebola',
      estimated_ready_at: '2026-05-20T11:30:00.000Z',
      delivery_fee: 12,
      cancellation_reason: null,
      order_number: 123,
    };
    client.orderItemRows = [
      {
        order_id: 'order-1',
        product_name: 'Espeto de Carne',
        quantity: 2,
        unit_price: 50,
        total_price: 100,
      },
    ];
    const repository = new SupabaseOrderRepository(client);

    const order = await repository.findById('order-1');

    expect(order?.id).toBe('order-1');
    expect(order?.orderNumber).toBe(123);
    expect(order?.customerName).toBe('Maria Silva');
    expect(order?.status).toBe(OrderStatus.ACCEPTED);
    expect(order?.createdAt).toEqual(new Date('2026-05-20T10:30:00.000Z'));
    expect(order?.finishedAt).toEqual(new Date('2026-05-20T12:00:00.000Z'));
    expect(order?.customerNote).toBe('Sem cebola');
    expect(order?.estimatedReadyAt).toEqual(
      new Date('2026-05-20T11:30:00.000Z'),
    );
    expect(order?.deliveryFee).toBe(12);
    expect(order?.total).toBe(112);
    expect(order?.items[0].product.name).toBe('Espeto de Carne');
  });

  it('deve listar pedidos e seus itens', async () => {
    const client = new FakeSupabaseClient();
    client.orderRows = [
      {
        id: 'order-1',
        customer_name: 'Maria Silva',
        customer_phone: '11999999999',
        order_type: 'DELIVERY',
        address: 'Rua dos Espetos, 123',
        status: 'PENDING',
        created_at: '2026-05-20T10:30:00.000Z',
        finished_at: '2026-05-20T12:00:00.000Z',
        customer_note: null,
        estimated_ready_at: null,
        delivery_fee: 8,
        cancellation_reason: null,
        order_number: 123,
      },
      {
        id: 'order-2',
        customer_name: 'Joao Souza',
        customer_phone: '11888888888',
        order_type: 'PICKUP',
        address: null,
        status: 'ACCEPTED',
        created_at: '2026-05-20T10:35:00.000Z',
        finished_at: null,
        customer_note: null,
        estimated_ready_at: null,
        delivery_fee: 0,
        cancellation_reason: null,
        order_number: 124,
      },
    ];
    client.orderItemRows = [
      {
        order_id: 'order-1',
        product_name: 'Espeto de Carne',
        quantity: 2,
        unit_price: 50,
        total_price: 100,
      },
      {
        order_id: 'order-2',
        product_name: 'Espeto de Frango',
        quantity: 1,
        unit_price: 35,
        total_price: 35,
      },
    ];
    const repository = new SupabaseOrderRepository(client);

    const orders = await repository.findAll();

    expect(orders).toHaveLength(2);
    expect(orders[0].id).toBe('order-1');
    expect(orders[0].orderNumber).toBe(123);
    expect(orders[0].createdAt).toEqual(
      new Date('2026-05-20T10:30:00.000Z'),
    );
    expect(orders[0].finishedAt).toEqual(
      new Date('2026-05-20T12:00:00.000Z'),
    );
    expect(orders[0].items).toHaveLength(1);
    expect(orders[0].total).toBe(108);
    expect(orders[1].id).toBe('order-2');
    expect(orders[1].items[0].product.name).toBe('Espeto de Frango');
    expect(orders[1].total).toBe(35);
  });

  it('deve listar pedidos filtrados por status e pagina', async () => {
    const client = new FakeSupabaseClient();
    client.orderRows = [
      {
        id: 'order-1',
        customer_name: 'Maria Silva',
        customer_phone: '11999999999',
        order_type: 'DELIVERY',
        address: 'Rua dos Espetos, 123',
        status: 'FINISHED',
        created_at: '2026-05-20T10:30:00.000Z',
        finished_at: '2026-05-20T12:00:00.000Z',
        customer_note: null,
        estimated_ready_at: null,
        delivery_fee: 8,
        cancellation_reason: null,
        order_number: 123,
      },
      {
        id: 'order-2',
        customer_name: 'Joao Souza',
        customer_phone: '11888888888',
        order_type: 'PICKUP',
        address: null,
        status: 'CANCELED',
        created_at: '2026-05-20T10:35:00.000Z',
        finished_at: null,
        customer_note: null,
        estimated_ready_at: null,
        delivery_fee: 0,
        cancellation_reason: 'Cliente desistiu',
        order_number: 124,
      },
      {
        id: 'order-3',
        customer_name: 'Ana Lima',
        customer_phone: '11777777777',
        order_type: 'PICKUP',
        address: null,
        status: 'PENDING',
        created_at: '2026-05-20T10:40:00.000Z',
        finished_at: null,
        customer_note: null,
        estimated_ready_at: null,
        delivery_fee: 0,
        cancellation_reason: null,
        order_number: 125,
      },
    ];
    client.orderItemRows = [
      {
        order_id: 'order-1',
        product_name: 'Espeto de Carne',
        quantity: 2,
        unit_price: 50,
        total_price: 100,
      },
      {
        order_id: 'order-2',
        product_name: 'Espeto de Frango',
        quantity: 1,
        unit_price: 35,
        total_price: 35,
      },
      {
        order_id: 'order-3',
        product_name: 'Espeto de Linguica',
        quantity: 1,
        unit_price: 40,
        total_price: 40,
      },
    ];
    const repository = new SupabaseOrderRepository(client);

    const orders = await repository.findAll({
      statuses: [OrderStatus.FINISHED, OrderStatus.CANCELED],
      limit: 1,
      offset: 1,
    });

    expect(orders).toHaveLength(1);
    expect(orders[0].id).toBe('order-2');
    expect(orders[0].items).toHaveLength(1);
    expect(orders[0].items[0].product.name).toBe('Espeto de Frango');
  });

  it('deve atualizar apenas o status do pedido', async () => {
    const client = new FakeSupabaseClient();
    const repository = new SupabaseOrderRepository(client);

    await repository.updateStatus('order-1', OrderStatus.IN_PREPARATION);

    expect(client.updatedOrders).toEqual([
      {
        id: 'order-1',
        row: {
          status: 'IN_PREPARATION',
          cancellation_reason: null,
        },
      },
    ]);
  });

  it('deve registrar horario de finalizacao ao finalizar pedido', async () => {
    const client = new FakeSupabaseClient();
    const repository = new SupabaseOrderRepository(client);
    const finishedAt = new Date('2026-05-20T12:00:00.000Z');

    await repository.updateStatus('order-1', OrderStatus.FINISHED, finishedAt);

    expect(client.updatedOrders).toEqual([
      {
        id: 'order-1',
        row: {
          status: 'FINISHED',
          finished_at: '2026-05-20T12:00:00.000Z',
          cancellation_reason: null,
        },
      },
    ]);
  });

  it('deve registrar motivo ao cancelar pedido', async () => {
    const client = new FakeSupabaseClient();
    const repository = new SupabaseOrderRepository(client);

    await repository.updateStatus(
      'order-1',
      OrderStatus.CANCELED,
      undefined,
      'Produto indisponivel',
    );

    expect(client.updatedOrders).toEqual([
      {
        id: 'order-1',
        row: {
          status: 'CANCELED',
          cancellation_reason: 'Produto indisponivel',
        },
      },
    ]);
  });

  it('deve registrar previsao do pedido', async () => {
    const client = new FakeSupabaseClient();
    const repository = new SupabaseOrderRepository(client);
    const estimatedReadyAt = new Date('2026-05-20T11:30:00.000Z');

    await repository.updateEstimatedReadyAt('order-1', estimatedReadyAt);

    expect(client.updatedOrders).toEqual([
      {
        id: 'order-1',
        row: {
          estimated_ready_at: '2026-05-20T11:30:00.000Z',
        },
      },
    ]);
  });

  it('deve retornar null quando pedido nao existir', async () => {
    const client = new FakeSupabaseClient();
    const repository = new SupabaseOrderRepository(client);

    await expect(repository.findById('missing-order')).resolves.toBeNull();
  });

  it('deve consultar status do pedido do cliente pela RPC', async () => {
    const client = new FakeSupabaseClient();
    client.customerOrderStatusRows = [
      {
        id: 'order-1',
        customer_name: 'Maria Silva',
        customer_phone: '(11)99999-9999',
        order_type: 'DELIVERY',
        address: 'Rua dos Espetos, 123',
        status: 'OUT_FOR_DELIVERY',
        created_at: '2026-05-20T10:30:00.000Z',
        finished_at: null,
        customer_note: 'Entregar na portaria',
        estimated_ready_at: '2026-05-20T11:30:00.000Z',
        delivery_fee: 8,
        cancellation_reason: 'Cliente desistiu',
        order_number: 123,
        product_name: 'Espeto de Carne',
        quantity: 2,
        unit_price: 50,
        total_price: 100,
      },
      {
        id: 'order-1',
        customer_name: 'Maria Silva',
        customer_phone: '(11)99999-9999',
        order_type: 'DELIVERY',
        address: 'Rua dos Espetos, 123',
        status: 'OUT_FOR_DELIVERY',
        created_at: '2026-05-20T10:30:00.000Z',
        finished_at: null,
        customer_note: 'Entregar na portaria',
        estimated_ready_at: '2026-05-20T11:30:00.000Z',
        delivery_fee: 8,
        cancellation_reason: 'Cliente desistiu',
        order_number: 123,
        product_name: 'Espeto de Frango',
        quantity: 1,
        unit_price: 35,
        total_price: 35,
      },
    ];
    const repository = new SupabaseOrderRepository(client);

    const order = await repository.findByOrderNumberAndPhone(
      123,
      '(11)99999-9999',
    );

    expect(client.rpcCalls.at(-1)).toEqual({
      functionName: 'get_customer_order_status',
      params: {
        p_order_number: 123,
        p_customer_phone: '(11)99999-9999',
      },
    });
    expect(order?.id).toBe('order-1');
    expect(order?.orderNumber).toBe(123);
    expect(order?.status).toBe(OrderStatus.OUT_FOR_DELIVERY);
    expect(order?.cancellationReason).toBeUndefined();
    expect(order?.customerNote).toBe('Entregar na portaria');
    expect(order?.estimatedReadyAt).toEqual(
      new Date('2026-05-20T11:30:00.000Z'),
    );
    expect(order?.items).toHaveLength(2);
    expect(order?.total).toBe(143);
  });

  it('deve retornar null quando RPC nao encontrar pedido do cliente', async () => {
    const client = new FakeSupabaseClient();
    const repository = new SupabaseOrderRepository(client);

    await expect(
      repository.findByOrderNumberAndPhone(999, '11999999999'),
    ).resolves.toBeNull();
  });

  it('deve cancelar pedido do cliente pela RPC', async () => {
    const client = new FakeSupabaseClient();
    client.customerOrderStatusRows = [
      {
        id: 'order-1',
        customer_name: 'Maria Silva',
        customer_phone: '(11)99999-9999',
        order_type: 'PICKUP',
        address: null,
        status: 'PENDING',
        created_at: '2026-05-20T10:30:00.000Z',
        finished_at: null,
        customer_note: null,
        estimated_ready_at: null,
        delivery_fee: 0,
        cancellation_reason: null,
        order_number: 123,
        product_name: 'Espeto de Carne',
        quantity: 2,
        unit_price: 50,
        total_price: 100,
      },
    ];
    const repository = new SupabaseOrderRepository(client);

    const order = await repository.cancelByOrderNumberAndPhone(
      123,
      '(11)99999-9999',
    );

    expect(client.rpcCalls.at(-1)).toEqual({
      functionName: 'cancel_customer_order',
      params: {
        p_order_number: 123,
        p_customer_phone: '(11)99999-9999',
      },
    });
    expect(order.status).toBe(OrderStatus.CANCELED);
    expect(order.cancellationReason).toBe('Cancelado pelo cliente');
  });
});
