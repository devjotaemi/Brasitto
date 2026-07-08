import type {
  DatabaseMonitoringMetric,
  DatabaseMonitoringRepository,
} from '../repositories/DatabaseMonitoringRepository';

export class GetDatabaseMonitoringUseCase {
  constructor(private readonly repository: DatabaseMonitoringRepository) {}

  async execute(): Promise<DatabaseMonitoringMetric[]> {
    return this.repository.getMetrics();
  }
}
