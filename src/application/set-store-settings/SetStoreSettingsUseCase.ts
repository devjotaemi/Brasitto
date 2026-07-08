import type {
  StoreSettings,
  StoreSettingsRepository,
} from '../repositories/StoreSettingsRepository';

export type SetStoreSettingsInput = StoreSettings;

export class SetStoreSettingsUseCase {
  constructor(private readonly storeSettingsRepository: StoreSettingsRepository) {}

  async execute(input: SetStoreSettingsInput): Promise<StoreSettings> {
    if (!Number.isFinite(input.deliveryFee) || input.deliveryFee < 0) {
      throw new Error('Delivery fee must be zero or greater');
    }

    return this.storeSettingsRepository.setSettings({
      storeOpen: input.storeOpen,
      deliveryFee: input.deliveryFee,
    });
  }
}
