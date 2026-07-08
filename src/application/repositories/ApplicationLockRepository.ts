export type ApplicationLockStatus = {
  locked: boolean;
  reason: string;
  updatedAt?: Date;
};

export interface ApplicationLockRepository {
  getStatus(): Promise<ApplicationLockStatus>;
  setLocked(locked: boolean): Promise<ApplicationLockStatus>;
}
