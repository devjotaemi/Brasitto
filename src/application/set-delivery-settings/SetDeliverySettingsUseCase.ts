import type {
  DeliveryRegion,
  DeliverySettings,
  StoreSettings,
  StoreSettingsRepository,
} from '../repositories/StoreSettingsRepository';

export type SetDeliverySettingsInput = {
  deliveryFee: number;
  deliveryRegions?: DeliveryRegion[];
};

const validateDeliverySettings = (
  input: SetDeliverySettingsInput,
): DeliverySettings => {
  if (!Number.isFinite(input.deliveryFee) || input.deliveryFee < 0) {
    throw new Error('Delivery fee must be zero or greater');
  }

  const deliveryRegions = input.deliveryRegions ?? [];

  for (const region of deliveryRegions) {
    if (!region.name.trim()) {
      throw new Error('Delivery region must have a name');
    }

    if (!Number.isFinite(region.fee) || region.fee < 0) {
      throw new Error('Delivery region fee must be zero or greater');
    }
  }

  return {
    deliveryFee: input.deliveryFee,
    deliveryRegions: deliveryRegions.map((region) => ({
      name: region.name.trim(),
      fee: region.fee,
    })),
  };
};

export class SetDeliverySettingsUseCase {
  constructor(private readonly storeSettingsRepository: StoreSettingsRepository) {}

  async execute(input: SetDeliverySettingsInput): Promise<StoreSettings> {
    return this.storeSettingsRepository.setDeliverySettings(
      validateDeliverySettings(input),
    );
  }
}

export { validateDeliverySettings };
