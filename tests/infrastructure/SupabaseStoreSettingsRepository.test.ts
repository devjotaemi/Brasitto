import { describe, expect, it } from 'vitest';
import { SupabaseStoreSettingsRepository } from '../../src/infrastructure/repositories/SupabaseStoreSettingsRepository';

type QueryResult = {
  data?: unknown;
  error?: Error | null;
};

class FakeSupabaseClient {
  readonly rpcCalls: Array<{
    functionName: string;
    params: Record<string, unknown>;
  }> = [];

  constructor(private readonly row: unknown) {}

  async rpc(
    functionName: string,
    params: Record<string, unknown> = {},
  ): Promise<QueryResult> {
    this.rpcCalls.push({ functionName, params });

    return {
      data: this.row,
      error: null,
    };
  }
}

describe('SupabaseStoreSettingsRepository', () => {
  it('deve consultar configuracoes pela RPC', async () => {
    const client = new FakeSupabaseClient([
      {
        store_open: false,
        delivery_fee: 12,
      },
    ]);
    const repository = new SupabaseStoreSettingsRepository(client);

    await expect(repository.getSettings()).resolves.toEqual({
      storeOpen: false,
      deliveryFee: 12,
    });
    expect(client.rpcCalls).toEqual([
      {
        functionName: 'get_store_settings',
        params: {},
      },
    ]);
  });

  it('deve salvar configuracoes pela RPC', async () => {
    const client = new FakeSupabaseClient({
      store_open: true,
      delivery_fee: 10,
    });
    const repository = new SupabaseStoreSettingsRepository(client);

    await expect(
      repository.setSettings({
        storeOpen: true,
        deliveryFee: 10,
      }),
    ).resolves.toEqual({
      storeOpen: true,
      deliveryFee: 10,
    });
    expect(client.rpcCalls).toEqual([
      {
        functionName: 'set_store_settings',
        params: {
          p_store_open: true,
          p_delivery_fee: 10,
        },
      },
    ]);
  });

  it('deve falhar quando Supabase retornar erro', async () => {
    const client = {
      rpc: async (): Promise<QueryResult> => ({
        error: new Error('Only owner can change store settings'),
      }),
    };
    const repository = new SupabaseStoreSettingsRepository(client);

    await expect(
      repository.setSettings({
        storeOpen: false,
        deliveryFee: 8,
      }),
    ).rejects.toThrow('Only owner can change store settings');
  });
});
