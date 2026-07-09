import type { Comanda } from '../../domain/comanda/Comanda';
import type { ComandaRepository } from '../repositories/ComandaRepository';

export type CancelComandaItemInput = {
  comandaId: string;
  itemId: string;
};

export class CancelComandaItemUseCase {
  constructor(private readonly comandaRepository: ComandaRepository) {}

  async execute(input: CancelComandaItemInput): Promise<Comanda> {
    return this.comandaRepository.cancelItem(input.comandaId, input.itemId);
  }
}
