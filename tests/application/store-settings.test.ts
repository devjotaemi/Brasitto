import { describe, expect, it } from 'vitest';
import type {
  StoreSettings,
  StoreSettingsRepository,
} from '../../src/application/repositories/StoreSettingsRepository';
import { GetStoreSettingsUseCase } from '../../src/application/get-store-settings/GetStoreSettingsUseCase';
import { SetDeliverySettingsUseCase } from '../../src/application/set-delivery-settings/SetDeliverySettingsUseCase';
import { SetStoreSettingsUseCase } from '../../src/application/set-store-settings/SetStoreSettingsUseCase';

class FakeStoreSettingsRepository implements StoreSettingsRepository {
  settings: StoreSettings = {
    storeOpen: true,
    deliveryFee: 8,
    deliveryRegions: [],
  };

  async getSettings(): Promise<StoreSettings> {
    return this.settings;
  }

  async setSettings(settings: StoreSettings): Promise<StoreSettings> {
    this.settings = settings;

    return this.settings;
  }

  async setDeliverySettings(
    settings: Pick<StoreSettings, 'deliveryFee' | 'deliveryRegions'>,
  ): Promise<StoreSettings> {
    this.settings = {
      ...this.settings,
      deliveryFee: settings.deliveryFee,
      deliveryRegions: settings.deliveryRegions,
    };

    return this.settings;
  }
}

describe('Store settings use cases', () => {
  it('deve consultar configuracoes da loja', async () => {
    const repository = new FakeStoreSettingsRepository();
    repository.settings = {
      storeOpen: false,
      deliveryFee: 12,
      deliveryRegions: [{ name: 'Centro', fee: 5 }],
    };
    const useCase = new GetStoreSettingsUseCase(repository);

    await expect(useCase.execute()).resolves.toEqual({
      storeOpen: false,
      deliveryFee: 12,
      deliveryRegions: [{ name: 'Centro', fee: 5 }],
    });
  });

  it('deve atualizar configuracoes da loja', async () => {
    const repository = new FakeStoreSettingsRepository();
    const useCase = new SetStoreSettingsUseCase(repository);

    await expect(
      useCase.execute({
        storeOpen: true,
        deliveryFee: 10,
        deliveryRegions: [{ name: ' Centro ', fee: 6 }],
      }),
    ).resolves.toEqual({
      storeOpen: true,
      deliveryFee: 10,
      deliveryRegions: [{ name: 'Centro', fee: 6 }],
    });
  });

  it('deve atualizar apenas configuracoes de frete mantendo disponibilidade da loja', async () => {
    const repository = new FakeStoreSettingsRepository();
    repository.settings = {
      storeOpen: false,
      deliveryFee: 8,
      deliveryRegions: [],
    };
    const useCase = new SetDeliverySettingsUseCase(repository);

    await expect(
      useCase.execute({
        deliveryFee: 10,
        deliveryRegions: [{ name: ' Centro ', fee: 6 }],
      }),
    ).resolves.toEqual({
      storeOpen: false,
      deliveryFee: 10,
      deliveryRegions: [{ name: 'Centro', fee: 6 }],
    });
  });

  it('deve rejeitar taxa de entrega negativa', async () => {
    const repository = new FakeStoreSettingsRepository();
    const useCase = new SetStoreSettingsUseCase(repository);

    await expect(
      useCase.execute({
        storeOpen: true,
        deliveryFee: -1,
        deliveryRegions: [],
      }),
    ).rejects.toThrow('Delivery fee must be zero or greater');
  });

  it('deve rejeitar bairro sem nome', async () => {
    const repository = new FakeStoreSettingsRepository();
    const useCase = new SetStoreSettingsUseCase(repository);

    await expect(
      useCase.execute({
        storeOpen: true,
        deliveryFee: 8,
        deliveryRegions: [{ name: '  ', fee: 5 }],
      }),
    ).rejects.toThrow('Delivery region must have a name');
  });

  it('deve rejeitar taxa de bairro negativa', async () => {
    const repository = new FakeStoreSettingsRepository();
    const useCase = new SetStoreSettingsUseCase(repository);

    await expect(
      useCase.execute({
        storeOpen: true,
        deliveryFee: 8,
        deliveryRegions: [{ name: 'Centro', fee: -2 }],
      }),
    ).rejects.toThrow('Delivery region fee must be zero or greater');
  });
});
