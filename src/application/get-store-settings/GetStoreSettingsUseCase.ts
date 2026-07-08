import type {
  StoreSettings,
  StoreSettingsRepository,
} from '../repositories/StoreSettingsRepository';

export class GetStoreSettingsUseCase {
  constructor(private readonly storeSettingsRepository: StoreSettingsRepository) {}

  async execute(): Promise<StoreSettings> {
    return this.storeSettingsRepository.getSettings();
  }
}
