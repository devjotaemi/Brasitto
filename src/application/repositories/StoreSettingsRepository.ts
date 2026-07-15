export type DeliveryRegion = {
  name: string;
  fee: number;
};

export type StoreSettings = {
  storeOpen: boolean;
  deliveryFee: number;
  deliveryRegions: DeliveryRegion[];
};

export interface StoreSettingsRepository {
  getSettings(): Promise<StoreSettings>;
  setSettings(settings: StoreSettings): Promise<StoreSettings>;
}
