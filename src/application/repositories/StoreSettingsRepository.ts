export type DeliveryRegion = {
  name: string;
  fee: number;
};

export type StoreSettings = {
  storeOpen: boolean;
  deliveryFee: number;
  deliveryRegions: DeliveryRegion[];
};

export type DeliverySettings = Pick<
  StoreSettings,
  'deliveryFee' | 'deliveryRegions'
>;

export interface StoreSettingsRepository {
  getSettings(): Promise<StoreSettings>;
  setSettings(settings: StoreSettings): Promise<StoreSettings>;
  setDeliverySettings(settings: DeliverySettings): Promise<StoreSettings>;
}
