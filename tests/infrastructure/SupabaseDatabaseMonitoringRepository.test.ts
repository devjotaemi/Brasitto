import { describe, expect, it } from 'vitest';
import { SupabaseDatabaseMonitoringRepository } from '../../src/infrastructure/repositories/SupabaseDatabaseMonitoringRepository';

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

describe('SupabaseDatabaseMonitoringRepository', () => {
  it('deve consultar metricas pela RPC segura', async () => {
    const client = new FakeSupabaseClient([
      {
        metric: 'blocked_queries',
        severity: 'warning',
        label: 'Queries bloqueadas por lock',
        count: '2',
        max_duration_seconds: '45',
        sample_application_name: 'postgrest',
        checked_at: '2026-05-25T10:00:00.000Z',
      },
    ]);
    const repository = new SupabaseDatabaseMonitoringRepository(client);

    await expect(repository.getMetrics()).resolves.toEqual([
      {
        metric: 'blocked_queries',
        severity: 'warning',
        label: 'Queries bloqueadas por lock',
        count: 2,
        maxDurationSeconds: 45,
        sampleApplicationName: 'postgrest',
        checkedAt: new Date('2026-05-25T10:00:00.000Z'),
      },
    ]);
    expect(client.rpcCalls).toEqual([
      {
        functionName: 'get_database_monitoring',
        params: {},
      },
    ]);
  });

  it('deve normalizar severidade desconhecida', async () => {
    const client = new FakeSupabaseClient({
      metric: 'connection_usage',
      severity: 'unexpected',
      label: 'Uso de conexoes do banco',
      count: 5,
      max_duration_seconds: 0,
    });
    const repository = new SupabaseDatabaseMonitoringRepository(client);

    await expect(repository.getMetrics()).resolves.toEqual([
      {
        metric: 'connection_usage',
        severity: 'info',
        label: 'Uso de conexoes do banco',
        count: 5,
        maxDurationSeconds: 0,
        sampleApplicationName: undefined,
        checkedAt: undefined,
      },
    ]);
  });

  it('deve falhar quando Supabase retornar erro', async () => {
    const client = {
      rpc: async (): Promise<QueryResult> => ({
        error: new Error('Only owner can view database monitoring'),
      }),
    };
    const repository = new SupabaseDatabaseMonitoringRepository(client);

    await expect(repository.getMetrics()).rejects.toThrow(
      'Only owner can view database monitoring',
    );
  });
});
