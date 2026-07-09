import type { Comanda } from '../../domain/comanda/Comanda';
import type {
  ComandaListOptions,
  ComandaRepository,
} from '../repositories/ComandaRepository';

export class ListCommandasUseCase {
  constructor(private readonly comandaRepository: ComandaRepository) {}

  async execute(options?: ComandaListOptions): Promise<Comanda[]> {
    return this.comandaRepository.findAll(options);
  }
}
