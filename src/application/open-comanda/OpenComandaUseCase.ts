import {
  Comanda,
  type ComandaProps,
} from '../../domain/comanda/Comanda';
import type { ComandaRepository } from '../repositories/ComandaRepository';

export class OpenComandaUseCase {
  constructor(private readonly comandaRepository: ComandaRepository) {}

  async execute(input: ComandaProps): Promise<Comanda> {
    const comanda = Comanda.create(input);

    return this.comandaRepository.save(comanda);
  }
}
