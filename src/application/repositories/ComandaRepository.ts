import type {
  Comanda,
  ComandaStatus,
} from '../../domain/comanda/Comanda';
import type { Product } from '../../domain/product/Product';

export type ComandaListOptions = {
  statuses?: ComandaStatus[];
};

export interface ComandaRepository {
  save(comanda: Comanda): Promise<Comanda>;
  findById(id: string): Promise<Comanda | null>;
  findAll(options?: ComandaListOptions): Promise<Comanda[]>;
  addItem(comandaId: string, product: Product, quantity: number): Promise<Comanda>;
  cancelItem(comandaId: string, itemId: string): Promise<Comanda>;
  close(comandaId: string): Promise<Comanda>;
}
