import { describe, expect, it } from 'vitest';
import { Comanda, ComandaStatus } from '../../src/domain/comanda/Comanda';
import { Product } from '../../src/domain/product/Product';

const product = Product.create({
  id: 'product-1',
  name: 'Espeto de Carne',
  description: 'Espeto bovino assado na brasa',
  price: 12,
  active: true,
});

describe('Comanda', () => {
  it('deve abrir comanda sem itens', () => {
    const comanda = Comanda.create({
      id: 'comanda-1',
      label: 'Mesa 4',
    });

    expect(comanda.label).toBe('Mesa 4');
    expect(comanda.status).toBe(ComandaStatus.OPEN);
    expect(comanda.total).toBe(0);
  });

  it('deve abrir comanda por mesa e cliente', () => {
    const comanda = Comanda.create({
      id: 'comanda-1',
      tableNumber: 4,
      customerName: 'Joao',
    });

    expect(comanda.tableNumber).toBe(4);
    expect(comanda.customerName).toBe('Joao');
    expect(comanda.label).toBe('Mesa 4 - Joao');
  });

  it('nao deve abrir comanda de mesa sem cliente', () => {
    expect(() =>
      Comanda.create({
        id: 'comanda-1',
        tableNumber: 4,
      }),
    ).toThrow('Comanda customer name is required');
  });

  it('nao deve abrir comanda com mesa fora do intervalo permitido', () => {
    expect(() =>
      Comanda.create({
        id: 'comanda-1',
        tableNumber: 51,
        customerName: 'Joao',
      }),
    ).toThrow('Comanda table number must be between 1 and 50');
  });

  it('deve adicionar item e calcular total', () => {
    const comanda = Comanda.create({
      id: 'comanda-1',
      label: 'Mesa 4',
    }).addItem(product, 2, 'item-1');

    expect(comanda.items).toHaveLength(1);
    expect(comanda.items[0].totalPrice).toBe(24);
    expect(comanda.total).toBe(24);
  });

  it('deve cancelar item sem apagar historico', () => {
    const comanda = Comanda.create({
      id: 'comanda-1',
      label: 'Mesa 4',
    })
      .addItem(product, 2, 'item-1')
      .cancelItem('item-1', new Date('2026-07-08T12:00:00.000Z'));

    expect(comanda.items[0].canceledAt).toEqual(
      new Date('2026-07-08T12:00:00.000Z'),
    );
    expect(comanda.total).toBe(0);
  });

  it('deve fechar comanda aberta', () => {
    const comanda = Comanda.create({
      id: 'comanda-1',
      label: 'Mesa 4',
    }).close(new Date('2026-07-08T12:00:00.000Z'));

    expect(comanda.status).toBe(ComandaStatus.CLOSED);
    expect(comanda.closedAt).toEqual(new Date('2026-07-08T12:00:00.000Z'));
  });
});
