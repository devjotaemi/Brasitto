export type DatabaseMonitoringSeverity = 'critical' | 'warning' | 'info';

export type DatabaseMonitoringMetric = {
  metric: string;
  severity: DatabaseMonitoringSeverity;
  label: string;
  count: number;
  maxDurationSeconds: number;
  sampleApplicationName?: string;
  checkedAt?: Date;
};

export interface DatabaseMonitoringRepository {
  getMetrics(): Promise<DatabaseMonitoringMetric[]>;
}
