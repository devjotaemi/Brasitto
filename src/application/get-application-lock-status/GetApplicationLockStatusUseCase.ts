import type {
  ApplicationLockRepository,
  ApplicationLockStatus,
} from '../repositories/ApplicationLockRepository';

export class GetApplicationLockStatusUseCase {
  constructor(private readonly applicationLockRepository: ApplicationLockRepository) {}

  async execute(): Promise<ApplicationLockStatus> {
    return this.applicationLockRepository.getStatus();
  }
}
