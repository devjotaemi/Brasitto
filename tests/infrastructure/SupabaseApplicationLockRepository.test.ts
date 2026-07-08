import { describe, expect, it } from 'vitest';
import { SupabaseApplicationLockRepository } from '../../src/infrastructure/repositories/SupabaseApplicationLockRepository';

type QueryResult = {
  data?: unknown;
  error?: Error | null;
};

class FakeSupabaseClient {
  readonly rpcCalls: Array<{
    functionName: string;
    params: Record<string, unknown>;
  }> = [];

  constructor(private readonly statusRow: unknown) {}

  async rpc(
    functionName: string,
    params: Record<string, unknown> = {},
  ): Promise<QueryResult> {
    this.rpcCalls.push({ functionName, params });

    return {
      data: this.statusRow,
      error: null,
    };
  }
}

describe('SupabaseApplicationLockRepository', () => {
  it('deve consultar status de bloqueio pela RPC', async () => {
    const client = new FakeSupabaseClient([
      {
        locked: true,
        reason: 'payment_overdue',
        updated_at: '2026-05-22T10:00:00.000Z',
      },
    ]);
    const repository = new SupabaseApplicationLockRepository(client);

    await expect(repository.getStatus()).resolves.toEqual({
      locked: true,
      reason: 'payment_overdue',
      updatedAt: new Date('2026-05-22T10:00:00.000Z'),
    });
    expect(client.rpcCalls).toEqual([
      {
        functionName: 'get_application_lock_status',
        params: {},
      },
    ]);
  });

  it('deve alterar status de bloqueio pela RPC', async () => {
    const client = new FakeSupabaseClient({
      locked: false,
      reason: 'payment_overdue',
      updated_at: '2026-05-22T12:00:00.000Z',
    });
    const repository = new SupabaseApplicationLockRepository(client);

    await expect(repository.setLocked(false)).resolves.toEqual({
      locked: false,
      reason: 'payment_overdue',
      updatedAt: new Date('2026-05-22T12:00:00.000Z'),
    });
    expect(client.rpcCalls).toEqual([
      {
        functionName: 'set_application_lock_status',
        params: { p_locked: false },
      },
    ]);
  });

  it('deve falhar quando Supabase retornar erro', async () => {
    const client = {
      rpc: async (): Promise<QueryResult> => ({
        error: new Error('Only owner can change lock status'),
      }),
    };
    const repository = new SupabaseApplicationLockRepository(client);

    await expect(repository.setLocked(true)).rejects.toThrow(
      'Only owner can change lock status',
    );
  });
});
