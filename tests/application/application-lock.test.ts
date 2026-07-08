import { describe, expect, it } from 'vitest';
import type {
  ApplicationLockRepository,
  ApplicationLockStatus,
} from '../../src/application/repositories/ApplicationLockRepository';
import { GetApplicationLockStatusUseCase } from '../../src/application/get-application-lock-status/GetApplicationLockStatusUseCase';
import { SetApplicationLockStatusUseCase } from '../../src/application/set-application-lock-status/SetApplicationLockStatusUseCase';

class FakeApplicationLockRepository implements ApplicationLockRepository {
  status: ApplicationLockStatus = {
    locked: false,
    reason: 'payment_overdue',
  };

  async getStatus(): Promise<ApplicationLockStatus> {
    return this.status;
  }

  async setLocked(locked: boolean): Promise<ApplicationLockStatus> {
    this.status = {
      locked,
      reason: 'payment_overdue',
      updatedAt: new Date('2026-05-22T12:00:00.000Z'),
    };

    return this.status;
  }
}

describe('Application lock use cases', () => {
  it('deve consultar o status atual do bloqueio', async () => {
    const repository = new FakeApplicationLockRepository();
    repository.status = {
      locked: true,
      reason: 'payment_overdue',
      updatedAt: new Date('2026-05-22T10:00:00.000Z'),
    };
    const useCase = new GetApplicationLockStatusUseCase(repository);

    await expect(useCase.execute()).resolves.toEqual(repository.status);
  });

  it('deve bloquear a aplicacao', async () => {
    const repository = new FakeApplicationLockRepository();
    const useCase = new SetApplicationLockStatusUseCase(repository);

    await expect(useCase.execute({ locked: true })).resolves.toEqual({
      locked: true,
      reason: 'payment_overdue',
      updatedAt: new Date('2026-05-22T12:00:00.000Z'),
    });
  });

  it('deve liberar a aplicacao', async () => {
    const repository = new FakeApplicationLockRepository();
    repository.status = {
      locked: true,
      reason: 'payment_overdue',
    };
    const useCase = new SetApplicationLockStatusUseCase(repository);

    await expect(useCase.execute({ locked: false })).resolves.toMatchObject({
      locked: false,
      reason: 'payment_overdue',
    });
  });
});
