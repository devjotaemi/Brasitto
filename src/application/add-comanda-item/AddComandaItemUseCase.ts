import type { Comanda } from '../../domain/comanda/Comanda';
import type { Product } from '../../domain/product/Product';
import type { ComandaRepository } from '../repositories/ComandaRepository';

export type AddComandaItemInput = {
  comandaId: string;
  product: Product;
  quantity: number;
};

export class AddComandaItemUseCase {
  constructor(private readonly comandaRepository: ComandaRepository) {}

  async execute(input: AddComandaItemInput): Promise<Comanda> {
    return this.comandaRepository.addItem(
      input.comandaId,
      input.product,
      input.quantity,
    );
  }
}
