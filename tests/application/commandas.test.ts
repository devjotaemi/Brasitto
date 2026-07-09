import { describe, expect, it } from 'vitest';
import { AddComandaItemUseCase } from '../../src/application/add-comanda-item/AddComandaItemUseCase';
import { CancelComandaItemUseCase } from '../../src/application/cancel-comanda-item/CancelComandaItemUseCase';
import { CloseComandaUseCase } from '../../src/application/close-comanda/CloseComandaUseCase';
import { ListCommandasUseCase } from '../../src/application/list-commandas/ListCommandasUseCase';
import { OpenComandaUseCase } from '../../src/application/open-comanda/OpenComandaUseCase';
import type {
  ComandaListOptions,
  ComandaRepository,
} from '../../src/application/repositories/ComandaRepository';
import {
  Comanda,
  ComandaStatus,
} from '../../src/domain/comanda/Comanda';
import { Product } from '../../src/domain/product/Product';

class FakeComandaRepository implements ComandaRepository {
  readonly commandas = new Map<string, Comanda>();

  async save(comanda: Comanda): Promise<Comanda> {
    if (!comanda.id) {
      throw new Error('Comanda must have an id');
    }

    this.commandas.set(comanda.id, comanda);

    return comanda;
  }

  async findById(id: string): Promise<Comanda | null> {
    return this.commandas.get(id) ?? null;
  }

  async findAll(options: ComandaListOptions = {}): Promise<Comanda[]> {
    const commandas = [...this.commandas.values()];

    if (!options.statuses?.length) {
      return commandas;
    }

    return commandas.filter((comanda) =>
      options.statuses?.includes(comanda.status),
    );
  }

  async addItem(
    comandaId: string,
    product: Product,
    quantity: number,
  ): Promise<Comanda> {
    const comanda = await this.findById(comandaId);

    if (!comanda) {
      throw new Error('Comanda not found');
    }

    const updatedComanda = comanda.addItem(product, quantity, 'item-1');
    this.commandas.set(comandaId, updatedComanda);

    return updatedComanda;
  }

  async cancelItem(comandaId: string, itemId: string): Promise<Comanda> {
    const comanda = await this.findById(comandaId);

    if (!comanda) {
      throw new Error('Comanda not found');
    }

    const updatedComanda = comanda.cancelItem(itemId);
    this.commandas.set(comandaId, updatedComanda);

    return updatedComanda;
  }

  async close(comandaId: string): Promise<Comanda> {
    const comanda = await this.findById(comandaId);

    if (!comanda) {
      throw new Error('Comanda not found');
    }

    const updatedComanda = comanda.close();
    this.commandas.set(comandaId, updatedComanda);

    return updatedComanda;
  }
}

const product = Product.create({
  id: 'product-1',
  name: 'Espeto de Carne',
  description: 'Espeto bovino assado na brasa',
  price: 12,
  active: true,
});

describe('Comanda use cases', () => {
  it('deve abrir, listar, adicionar item, cancelar item e fechar comanda', async () => {
    const repository = new FakeComandaRepository();
    const openComandaUseCase = new OpenComandaUseCase(repository);
    const listCommandasUseCase = new ListCommandasUseCase(repository);
    const addComandaItemUseCase = new AddComandaItemUseCase(repository);
    const cancelComandaItemUseCase = new CancelComandaItemUseCase(repository);
    const closeComandaUseCase = new CloseComandaUseCase(repository);

    await openComandaUseCase.execute({
      id: 'comanda-1',
      label: 'Mesa 4',
    });

    expect(
      await listCommandasUseCase.execute({
        statuses: [ComandaStatus.OPEN],
      }),
    ).toHaveLength(1);

    const comandaWithItem = await addComandaItemUseCase.execute({
      comandaId: 'comanda-1',
      product,
      quantity: 2,
    });

    expect(comandaWithItem.total).toBe(24);

    const comandaWithCanceledItem = await cancelComandaItemUseCase.execute({
      comandaId: 'comanda-1',
      itemId: 'item-1',
    });

    expect(comandaWithCanceledItem.total).toBe(0);

    const closedComanda = await closeComandaUseCase.execute('comanda-1');

    expect(closedComanda.status).toBe(ComandaStatus.CLOSED);
  });
});
