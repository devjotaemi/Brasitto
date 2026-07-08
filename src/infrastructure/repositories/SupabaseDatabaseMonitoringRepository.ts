import type {
  DatabaseMonitoringMetric,
  DatabaseMonitoringRepository,
  DatabaseMonitoringSeverity,
} from '../../application/repositories/DatabaseMonitoringRepository';

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

type DatabaseMonitoringRow = {
  metric?: string;
  severity?: string;
  label?: string;
  count?: number | string | null;
  max_duration_seconds?: number | string | null;
  sample_application_name?: string | null;
  checked_at?: string | null;
};

const allowedSeverities = new Set<DatabaseMonitoringSeverity>([
  'critical',
  'warning',
  'info',
]);

export class SupabaseDatabaseMonitoringRepository
  implements DatabaseMonitoringRepository
{
  constructor(private readonly supabase: SupabaseClient) {}

  async getMetrics(): Promise<DatabaseMonitoringMetric[]> {
    const result = (await this.supabase.rpc(
      'get_database_monitoring',
      {},
    )) as SupabaseQueryResult<unknown>;

    if (result.error) {
      throw result.error;
    }

    const rows = (Array.isArray(result.data)
      ? result.data
      : result.data
        ? [result.data]
        : []) as DatabaseMonitoringRow[];

    return rows.map((row) => ({
      metric: row.metric ?? 'unknown',
      severity: this.toSeverity(row.severity),
      label: row.label ?? 'Metrica desconhecida',
      count: Number(row.count ?? 0),
      maxDurationSeconds: Number(row.max_duration_seconds ?? 0),
      sampleApplicationName: row.sample_application_name ?? undefined,
      checkedAt: row.checked_at ? new Date(row.checked_at) : undefined,
    }));
  }

  private toSeverity(severity: string | undefined): DatabaseMonitoringSeverity {
    if (severity && allowedSeverities.has(severity as DatabaseMonitoringSeverity)) {
      return severity as DatabaseMonitoringSeverity;
    }

    return 'info';
  }
}
