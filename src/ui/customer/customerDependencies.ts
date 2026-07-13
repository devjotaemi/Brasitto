import { CalculateOrderTotalUseCase } from '../../application/calculate-order-total/CalculateOrderTotalUseCase';
import { AddComandaItemUseCase } from '../../application/add-comanda-item/AddComandaItemUseCase';
import { CancelComandaItemUseCase } from '../../application/cancel-comanda-item/CancelComandaItemUseCase';
import { CancelCustomerOrderUseCase } from '../../application/cancel-customer-order/CancelCustomerOrderUseCase';
import { CloseComandaUseCase } from '../../application/close-comanda/CloseComandaUseCase';
import { CreateOrderUseCase } from '../../application/create-order/CreateOrderUseCase';
import { GetCustomerOrderStatusUseCase } from '../../application/get-customer-order-status/GetCustomerOrderStatusUseCase';
import { GetDatabaseMonitoringUseCase } from '../../application/get-database-monitoring/GetDatabaseMonitoringUseCase';
import { GetApplicationLockStatusUseCase } from '../../application/get-application-lock-status/GetApplicationLockStatusUseCase';
import { GetStoreSettingsUseCase } from '../../application/get-store-settings/GetStoreSettingsUseCase';
import { ListCommandasUseCase } from '../../application/list-commandas/ListCommandasUseCase';
import { ListActiveProductsUseCase } from '../../application/list-active-products/ListActiveProductsUseCase';
import { ListProductsUseCase } from '../../application/list-products/ListProductsUseCase';
import { ListOrdersUseCase } from '../../application/list-orders/ListOrdersUseCase';
import { OpenComandaUseCase } from '../../application/open-comanda/OpenComandaUseCase';
import type {
  ApplicationLockRepository,
  ApplicationLockStatus,
} from '../../application/repositories/ApplicationLockRepository';
import type {
  ComandaListOptions,
  ComandaRepository,
} from '../../application/repositories/ComandaRepository';
import type {
  DatabaseMonitoringMetric,
  DatabaseMonitoringRepository,
} from '../../application/repositories/DatabaseMonitoringRepository';
import type { OrderRepository } from '../../application/repositories/OrderRepository';
import type { ProductRepository } from '../../application/repositories/ProductRepository';
import type {
  StoreSettings,
  StoreSettingsRepository,
} from '../../application/repositories/StoreSettingsRepository';
import { SaveProductUseCase } from '../../application/save-product/SaveProductUseCase';
import { SetApplicationLockStatusUseCase } from '../../application/set-application-lock-status/SetApplicationLockStatusUseCase';
import { SetStoreSettingsUseCase } from '../../application/set-store-settings/SetStoreSettingsUseCase';
import { UpdateOrderEstimateUseCase } from '../../application/update-order-estimate/UpdateOrderEstimateUseCase';
import { UpdateOrderStatusUseCase } from '../../application/update-order-status/UpdateOrderStatusUseCase';
import { Comanda, ComandaStatus } from '../../domain/comanda/Comanda';
import { OrderStatus, type Order } from '../../domain/order/Order';
import { Product } from '../../domain/product/Product';
import { SupabaseApplicationLockRepository } from '../../infrastructure/repositories/SupabaseApplicationLockRepository';
import { SupabaseComandaRepository } from '../../infrastructure/repositories/SupabaseComandaRepository';
import { SupabaseDatabaseMonitoringRepository } from '../../infrastructure/repositories/SupabaseDatabaseMonitoringRepository';
import { SupabaseOrderRepository } from '../../infrastructure/repositories/SupabaseOrderRepository';
import { SupabaseProductRepository } from '../../infrastructure/repositories/SupabaseProductRepository';
import { SupabaseStoreSettingsRepository } from '../../infrastructure/repositories/SupabaseStoreSettingsRepository';
import {
  isSupabaseConfigured,
  supabaseClient,
} from '../../infrastructure/supabase/supabaseClient';

export type RepositoryMode = 'local' | 'supabase';

type CustomerDependencies = {
  calculateOrderTotalUseCase: CalculateOrderTotalUseCase;
  cancelCustomerOrderUseCase: CancelCustomerOrderUseCase;
  createOrderUseCase: CreateOrderUseCase;
  getCustomerOrderStatusUseCase: GetCustomerOrderStatusUseCase;
  getDatabaseMonitoringUseCase: GetDatabaseMonitoringUseCase;
  listActiveProductsUseCase: ListActiveProductsUseCase;
  listProductsUseCase: ListProductsUseCase;
  listOrdersUseCase: ListOrdersUseCase;
  listCommandasUseCase: ListCommandasUseCase;
  openComandaUseCase: OpenComandaUseCase;
  addComandaItemUseCase: AddComandaItemUseCase;
  cancelComandaItemUseCase: CancelComandaItemUseCase;
  closeComandaUseCase: CloseComandaUseCase;
  saveProductUseCase: SaveProductUseCase;
  getApplicationLockStatusUseCase: GetApplicationLockStatusUseCase;
  setApplicationLockStatusUseCase: SetApplicationLockStatusUseCase;
  getStoreSettingsUseCase: GetStoreSettingsUseCase;
  setStoreSettingsUseCase: SetStoreSettingsUseCase;
  updateOrderEstimateUseCase: UpdateOrderEstimateUseCase;
  updateOrderStatusUseCase: UpdateOrderStatusUseCase;
  repositoryMode: RepositoryMode;
};

class LocalOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, Order>();

  async save(order: Order): Promise<Order> {
    if (!order.id) {
      throw new Error('Order must have an id to be saved');
    }

    this.orders.set(order.id, order);

    return order;
  }

  async findById(id: string): Promise<Order | null> {
    return this.orders.get(id) ?? null;
  }

  async findByOrderNumberAndPhone(
    orderNumber: number,
    customerPhone: string,
  ): Promise<Order | null> {
    const normalizedPhone = normalizePhone(customerPhone);

    return (
      [...this.orders.values()].find(
        (order) =>
          order.orderNumber === orderNumber &&
          normalizePhone(order.customerPhone) === normalizedPhone,
      ) ?? null
    );
  }

  async cancelByOrderNumberAndPhone(
    orderNumber: number,
    customerPhone: string,
  ): Promise<Order> {
    const order = await this.findByOrderNumberAndPhone(
      orderNumber,
      customerPhone,
    );

    if (!order?.id) {
      throw new Error('Customer order not found');
    }

    const canceledOrder = order.updateStatus(
      OrderStatus.CANCELED,
      undefined,
      'Cancelado pelo cliente',
    );
    this.orders.set(order.id, canceledOrder);

    return canceledOrder;
  }

  async findAll(): Promise<Order[]> {
    return [...this.orders.values()];
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    finishedAt?: Date,
    cancellationReason?: string,
  ): Promise<void> {
    const order = await this.findById(id);

    if (!order) {
      throw new Error('Order not found');
    }

    this.orders.set(
      id,
      order.updateStatus(status, finishedAt, cancellationReason),
    );
  }

  async updateEstimatedReadyAt(
    id: string,
    estimatedReadyAt?: Date,
  ): Promise<void> {
    const order = await this.findById(id);

    if (!order) {
      throw new Error('Order not found');
    }

    this.orders.set(id, order.updateEstimatedReadyAt(estimatedReadyAt));
  }
}

class LocalProductRepository implements ProductRepository {
  constructor(private readonly products: Product[]) {}

  async findAll(): Promise<Product[]> {
    return this.products;
  }

  async save(product: Product): Promise<void> {
    const productIndex = this.products.findIndex(
      (currentProduct) => currentProduct.id === product.id,
    );

    if (productIndex === -1) {
      this.products.push(product);
      return;
    }

    this.products.splice(productIndex, 1, product);
  }
}

class LocalComandaRepository implements ComandaRepository {
  private readonly commandas = new Map<string, Comanda>();

  async save(comanda: Comanda): Promise<Comanda> {
    if (!comanda.id) {
      throw new Error('Comanda must have an id to be saved');
    }

    if (
      comanda.status === ComandaStatus.OPEN &&
      comanda.tableNumber !== undefined &&
      [...this.commandas.values()].some(
        (currentComanda) =>
          currentComanda.id !== comanda.id &&
          currentComanda.status === ComandaStatus.OPEN &&
          currentComanda.tableNumber === comanda.tableNumber,
      )
    ) {
      throw new Error('Table already has an open comanda');
    }

    this.commandas.set(comanda.id, comanda);

    return comanda;
  }

  async findById(id: string): Promise<Comanda | null> {
    return this.commandas.get(id) ?? null;
  }

  async findAll(options: ComandaListOptions = {}): Promise<Comanda[]> {
    const commandas = [...this.commandas.values()];

    if (!options.statuses?.length) {
      return commandas;
    }

    return commandas.filter((comanda) =>
      options.statuses?.includes(comanda.status),
    );
  }

  async addItem(
    comandaId: string,
    product: Product,
    quantity: number,
  ): Promise<Comanda> {
    const comanda = await this.findById(comandaId);

    if (!comanda) {
      throw new Error('Comanda not found');
    }

    const updatedComanda = comanda.addItem(
      product,
      quantity,
      crypto.randomUUID(),
    );
    this.commandas.set(comandaId, updatedComanda);

    return updatedComanda;
  }

  async cancelItem(comandaId: string, itemId: string): Promise<Comanda> {
    const comanda = await this.findById(comandaId);

    if (!comanda) {
      throw new Error('Comanda not found');
    }

    const updatedComanda = comanda.cancelItem(itemId);
    this.commandas.set(comandaId, updatedComanda);

    return updatedComanda;
  }

  async close(comandaId: string): Promise<Comanda> {
    const comanda = await this.findById(comandaId);

    if (!comanda) {
      throw new Error('Comanda not found');
    }

    const updatedComanda = comanda.close();
    this.commandas.set(comandaId, updatedComanda);

    return updatedComanda;
  }
}

class LocalApplicationLockRepository implements ApplicationLockRepository {
  private status: ApplicationLockStatus = {
    locked: false,
    reason: 'payment_overdue',
  };

  async getStatus(): Promise<ApplicationLockStatus> {
    return this.status;
  }

  async setLocked(locked: boolean): Promise<ApplicationLockStatus> {
    this.status = {
      locked,
      reason: 'payment_overdue',
      updatedAt: new Date(),
    };

    return this.status;
  }
}

class LocalStoreSettingsRepository implements StoreSettingsRepository {
  private settings: StoreSettings = {
    storeOpen: true,
    deliveryFee: 8,
  };

  async getSettings(): Promise<StoreSettings> {
    return this.settings;
  }

  async setSettings(settings: StoreSettings): Promise<StoreSettings> {
    this.settings = settings;

    return this.settings;
  }
}

class LocalDatabaseMonitoringRepository implements DatabaseMonitoringRepository {
  async getMetrics(): Promise<DatabaseMonitoringMetric[]> {
    return [
      {
        metric: 'database_monitoring_unavailable',
        severity: 'info',
        label: 'Monitoramento do banco indisponivel no modo local',
        count: 0,
        maxDurationSeconds: 0,
        checkedAt: new Date(),
      },
    ];
  }
}

const normalizePhone = (value: string): string => value.replace(/\D/g, '');

const localProducts = [
  Product.create({
    id: 'beef-skewer',
    name: 'Espeto de Carne',
    description: 'Espeto bovino temperado e assado na brasa.',
    price: 12,
    active: true,
  }),
  Product.create({
    id: 'chicken-skewer',
    name: 'Espeto de Frango',
    description: 'Espeto de frango temperado e assado na brasa.',
    price: 10,
    active: true,
  }),
  Product.create({
    id: 'cheese-skewer',
    name: 'Espeto de Queijo Coalho',
    description: 'Queijo coalho grelhado na brasa.',
    price: 9,
    active: true,
  }),
];

let dependencies: CustomerDependencies | null = null;

export function createCustomerDependencies(): CustomerDependencies {
  if (dependencies) {
    return dependencies;
  }

  let productRepository: ProductRepository;
  let orderRepository: OrderRepository;
  let comandaRepository: ComandaRepository;
  let applicationLockRepository: ApplicationLockRepository;
  let storeSettingsRepository: StoreSettingsRepository;
  let databaseMonitoringRepository: DatabaseMonitoringRepository;
  let repositoryMode: RepositoryMode = 'local';

  if (isSupabaseConfigured && supabaseClient !== null) {
    productRepository = new SupabaseProductRepository(supabaseClient);
    orderRepository = new SupabaseOrderRepository(supabaseClient);
    comandaRepository = new SupabaseComandaRepository(supabaseClient);
    applicationLockRepository = new SupabaseApplicationLockRepository(
      supabaseClient,
    );
    storeSettingsRepository = new SupabaseStoreSettingsRepository(
      supabaseClient,
    );
    databaseMonitoringRepository = new SupabaseDatabaseMonitoringRepository(
      supabaseClient,
    );
    repositoryMode = 'supabase';
  } else {
    productRepository = new LocalProductRepository(localProducts);
    orderRepository = new LocalOrderRepository();
    comandaRepository = new LocalComandaRepository();
    applicationLockRepository = new LocalApplicationLockRepository();
    storeSettingsRepository = new LocalStoreSettingsRepository();
    databaseMonitoringRepository = new LocalDatabaseMonitoringRepository();
  }

  dependencies = {
    calculateOrderTotalUseCase: new CalculateOrderTotalUseCase(),
    cancelCustomerOrderUseCase: new CancelCustomerOrderUseCase(
      orderRepository,
    ),
    createOrderUseCase: new CreateOrderUseCase(orderRepository),
    getDatabaseMonitoringUseCase: new GetDatabaseMonitoringUseCase(
      databaseMonitoringRepository,
    ),
    getCustomerOrderStatusUseCase: new GetCustomerOrderStatusUseCase(
      orderRepository,
    ),
    listActiveProductsUseCase: new ListActiveProductsUseCase(
      productRepository,
    ),
    listProductsUseCase: new ListProductsUseCase(productRepository),
    listOrdersUseCase: new ListOrdersUseCase(orderRepository),
    listCommandasUseCase: new ListCommandasUseCase(comandaRepository),
    openComandaUseCase: new OpenComandaUseCase(comandaRepository),
    addComandaItemUseCase: new AddComandaItemUseCase(comandaRepository),
    cancelComandaItemUseCase: new CancelComandaItemUseCase(comandaRepository),
    closeComandaUseCase: new CloseComandaUseCase(comandaRepository),
    saveProductUseCase: new SaveProductUseCase(productRepository),
    getApplicationLockStatusUseCase: new GetApplicationLockStatusUseCase(
      applicationLockRepository,
    ),
    setApplicationLockStatusUseCase: new SetApplicationLockStatusUseCase(
      applicationLockRepository,
    ),
    getStoreSettingsUseCase: new GetStoreSettingsUseCase(
      storeSettingsRepository,
    ),
    setStoreSettingsUseCase: new SetStoreSettingsUseCase(
      storeSettingsRepository,
    ),
    updateOrderEstimateUseCase: new UpdateOrderEstimateUseCase(
      orderRepository,
    ),
    updateOrderStatusUseCase: new UpdateOrderStatusUseCase(orderRepository),
    repositoryMode,
  };

  return dependencies;
}
