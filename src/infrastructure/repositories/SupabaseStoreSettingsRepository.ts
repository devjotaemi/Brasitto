import type {
  StoreSettings,
  StoreSettingsRepository,
} from '../../application/repositories/StoreSettingsRepository';

type SupabaseQueryResult<T = unknown> = {
  data?: T;
  error?: Error | null;
};

type SupabaseClient = {
  rpc: (
    functionName: string,
    params?: Record<string, unknown>,
  ) => unknown;
};

type StoreSettingsRow = {
  store_open?: boolean;
  delivery_fee?: number;
};

export class SupabaseStoreSettingsRepository
  implements StoreSettingsRepository
{
  constructor(private readonly supabase: SupabaseClient) {}

  async getSettings(): Promise<StoreSettings> {
    const result = (await this.supabase.rpc(
      'get_store_settings',
      {},
    )) as SupabaseQueryResult<unknown>;

    return this.toSettings(result);
  }

  async setSettings(settings: StoreSettings): Promise<StoreSettings> {
    const result = (await this.supabase.rpc('set_store_settings', {
      p_store_open: settings.storeOpen,
      p_delivery_fee: settings.deliveryFee,
    })) as SupabaseQueryResult<unknown>;

    return this.toSettings(result);
  }

  private toSettings(result: SupabaseQueryResult<unknown>): StoreSettings {
    if (result.error) {
      throw result.error;
    }

    const row = (Array.isArray(result.data)
      ? result.data[0]
      : result.data) as StoreSettingsRow | undefined;

    return {
      storeOpen: row?.store_open ?? true,
      deliveryFee: Number(row?.delivery_fee ?? 8),
    };
  }
}
