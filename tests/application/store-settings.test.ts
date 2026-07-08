import { describe, expect, it } from 'vitest';
import type {
  StoreSettings,
  StoreSettingsRepository,
} from '../../src/application/repositories/StoreSettingsRepository';
import { GetStoreSettingsUseCase } from '../../src/application/get-store-settings/GetStoreSettingsUseCase';
import { SetStoreSettingsUseCase } from '../../src/application/set-store-settings/SetStoreSettingsUseCase';

class FakeStoreSettingsRepository implements StoreSettingsRepository {
  settings: StoreSettings = {
    storeOpen: true,
    deliveryFee: 8,
  };

  async getSettings(): Promise<StoreSettings> {
    return this.settings;
  }

  async setSettings(settings: StoreSettings): Promise<StoreSettings> {
    this.settings = settings;

    return this.settings;
  }
}

describe('Store settings use cases', () => {
  it('deve consultar configuracoes da loja', async () => {
    const repository = new FakeStoreSettingsRepository();
    repository.settings = {
      storeOpen: false,
      deliveryFee: 12,
    };
    const useCase = new GetStoreSettingsUseCase(repository);

    await expect(useCase.execute()).resolves.toEqual({
      storeOpen: false,
      deliveryFee: 12,
    });
  });

  it('deve atualizar configuracoes da loja', async () => {
    const repository = new FakeStoreSettingsRepository();
    const useCase = new SetStoreSettingsUseCase(repository);

    await expect(
      useCase.execute({
        storeOpen: true,
        deliveryFee: 10,
      }),
    ).resolves.toEqual({
      storeOpen: true,
      deliveryFee: 10,
    });
  });

  it('deve rejeitar taxa de entrega negativa', async () => {
    const repository = new FakeStoreSettingsRepository();
    const useCase = new SetStoreSettingsUseCase(repository);

    await expect(
      useCase.execute({
        storeOpen: true,
        deliveryFee: -1,
      }),
    ).rejects.toThrow('Delivery fee must be zero or greater');
  });
});
