export type StoreSettings = {
  storeOpen: boolean;
  deliveryFee: number;
};

export interface StoreSettingsRepository {
  getSettings(): Promise<StoreSettings>;
  setSettings(settings: StoreSettings): Promise<StoreSettings>;
}
