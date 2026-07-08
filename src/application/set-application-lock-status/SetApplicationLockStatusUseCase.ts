import type {
  ApplicationLockRepository,
  ApplicationLockStatus,
} from '../repositories/ApplicationLockRepository';

export type SetApplicationLockStatusInput = {
  locked: boolean;
};

export class SetApplicationLockStatusUseCase {
  constructor(private readonly applicationLockRepository: ApplicationLockRepository) {}

  async execute(
    input: SetApplicationLockStatusInput,
  ): Promise<ApplicationLockStatus> {
    return this.applicationLockRepository.setLocked(input.locked);
  }
}
