import type { Comanda } from '../../domain/comanda/Comanda';
import type { ComandaRepository } from '../repositories/ComandaRepository';

export class CloseComandaUseCase {
  constructor(private readonly comandaRepository: ComandaRepository) {}

  async execute(comandaId: string): Promise<Comanda> {
    return this.comandaRepository.close(comandaId);
  }
}
