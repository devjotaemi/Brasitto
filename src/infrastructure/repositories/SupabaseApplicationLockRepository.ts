import type {
  ApplicationLockRepository,
  ApplicationLockStatus,
} from '../../application/repositories/ApplicationLockRepository';

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

type ApplicationLockRow = {
  locked?: boolean;
  reason?: string | null;
  updated_at?: string | null;
};

export class SupabaseApplicationLockRepository
  implements ApplicationLockRepository
{
  constructor(private readonly supabase: SupabaseClient) {}

  async getStatus(): Promise<ApplicationLockStatus> {
    const result = (await this.supabase.rpc(
      'get_application_lock_status',
      {},
    )) as SupabaseQueryResult<unknown>;

    return this.toStatus(result);
  }

  async setLocked(locked: boolean): Promise<ApplicationLockStatus> {
    const result = (await this.supabase.rpc('set_application_lock_status', {
      p_locked: locked,
    })) as SupabaseQueryResult<unknown>;

    return this.toStatus(result);
  }

  private toStatus(
    result: SupabaseQueryResult<unknown>,
  ): ApplicationLockStatus {
    if (result.error) {
      throw result.error;
    }

    const row = (Array.isArray(result.data)
      ? result.data[0]
      : result.data) as ApplicationLockRow | undefined;

    return {
      locked: row?.locked ?? false,
      reason: row?.reason ?? 'payment_overdue',
      updatedAt: row?.updated_at ? new Date(row.updated_at) : undefined,
    };
  }
}
