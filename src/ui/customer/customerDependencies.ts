import { CalculateOrderTotalUseCase } from '../../application/calculate-order-total/CalculateOrderTotalUseCase';
import { CancelCustomerOrderUseCase } from '../../application/cancel-customer-order/CancelCustomerOrderUseCase';
import { CreateOrderUseCase } from '../../application/create-order/CreateOrderUseCase';
import { GetCustomerOrderStatusUseCase } from '../../application/get-customer-order-status/GetCustomerOrderStatusUseCase';
import { GetDatabaseMonitoringUseCase } from '../../application/get-database-monitoring/GetDatabaseMonitoringUseCase';
import { GetApplicationLockStatusUseCase } from '../../application/get-application-lock-status/GetApplicationLockStatusUseCase';
import { GetStoreSettingsUseCase } from '../../application/get-store-settings/GetStoreSettingsUseCase';
import { ListActiveProductsUseCase } from '../../application/list-active-products/ListActiveProductsUseCase';
import { ListProductsUseCase } from '../../application/list-products/ListProductsUseCase';
import { ListOrdersUseCase } from '../../application/list-orders/ListOrdersUseCase';
import type {
  ApplicationLockRepository,
  ApplicationLockStatus,
} from '../../application/repositories/ApplicationLockRepository';
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
import { OrderStatus, type Order } from '../../domain/order/Order';
import { Product } from '../../domain/product/Product';
import { SupabaseApplicationLockRepository } from '../../infrastructure/repositories/SupabaseApplicationLockRepository';
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
    id: 'chicken-pie',
    name: 'Torta de Frango',
    description: 'Frango desfiado, catupiry e massa dourada.',
    price: 40,
    active: true,
  }),
  Product.create({
    id: 'heart-of-palm-pie',
    name: 'Torta de Palmito',
    description: 'Palmito cremoso, ervas frescas e cobertura crocante.',
    price: 35,
    active: true,
  }),
  Product.create({
    id: 'chocolate-pie',
    name: 'Torta de Chocolate',
    description: 'Chocolate meio amargo, ganache e base amanteigada.',
    price: 45,
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
  let applicationLockRepository: ApplicationLockRepository;
  let storeSettingsRepository: StoreSettingsRepository;
  let databaseMonitoringRepository: DatabaseMonitoringRepository;
  let repositoryMode: RepositoryMode = 'local';

  if (isSupabaseConfigured && supabaseClient !== null) {
    productRepository = new SupabaseProductRepository(supabaseClient);
    orderRepository = new SupabaseOrderRepository(supabaseClient);
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
