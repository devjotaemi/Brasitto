import type { Product } from '../product/Product';

export enum ComandaStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  CANCELED = 'CANCELED',
}

export type ComandaItem = {
  id?: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  createdAt?: Date;
  canceledAt?: Date;
};

export type ComandaProps = {
  id?: string;
  comandaNumber?: number;
  label: string;
  items?: ComandaItem[];
  status?: ComandaStatus;
  openedAt?: Date;
  closedAt?: Date;
  notes?: string;
};

export class Comanda {
  private constructor(
    public readonly id: string | undefined,
    public readonly comandaNumber: number | undefined,
    public readonly label: string,
    public readonly items: ComandaItem[],
    public readonly status: ComandaStatus,
    public readonly total: number,
    public readonly openedAt: Date | undefined,
    public readonly closedAt: Date | undefined,
    public readonly notes: string | undefined,
  ) {}

  static create(props: ComandaProps): Comanda {
    const label = props.label.trim();

    if (label === '') {
      throw new Error('Comanda label is required');
    }

    const items = props.items ?? [];

    items.forEach((item) => {
      if (item.quantity <= 0) {
        throw new Error('Comanda item quantity must be greater than zero');
      }
    });

    return new Comanda(
      props.id,
      props.comandaNumber,
      label,
      [...items],
      props.status ?? ComandaStatus.OPEN,
      Comanda.calculateTotal(items),
      props.openedAt,
      props.closedAt,
      props.notes?.trim() || undefined,
    );
  }

  addItem(product: Product, quantity: number, id?: string): Comanda {
    if (this.status !== ComandaStatus.OPEN) {
      throw new Error('Only open comandas can receive items');
    }

    if (!product.active) {
      throw new Error('Inactive product cannot be added to comanda');
    }

    if (quantity <= 0) {
      throw new Error('Comanda item quantity must be greater than zero');
    }

    const item: ComandaItem = {
      id,
      product,
      quantity,
      unitPrice: product.price,
      totalPrice: product.price * quantity,
      createdAt: new Date(),
    };

    return Comanda.create({
      id: this.id,
      comandaNumber: this.comandaNumber,
      label: this.label,
      items: [...this.items, item],
      status: this.status,
      openedAt: this.openedAt,
      closedAt: this.closedAt,
      notes: this.notes,
    });
  }

  cancelItem(itemId: string, canceledAt = new Date()): Comanda {
    if (this.status !== ComandaStatus.OPEN) {
      throw new Error('Only open comandas can have items canceled');
    }

    const hasItem = this.items.some((item) => item.id === itemId);

    if (!hasItem) {
      throw new Error('Comanda item not found');
    }

    return Comanda.create({
      id: this.id,
      comandaNumber: this.comandaNumber,
      label: this.label,
      items: this.items.map((item) =>
        item.id === itemId ? { ...item, canceledAt } : item,
      ),
      status: this.status,
      openedAt: this.openedAt,
      closedAt: this.closedAt,
      notes: this.notes,
    });
  }

  close(closedAt = new Date()): Comanda {
    if (this.status !== ComandaStatus.OPEN) {
      throw new Error('Only open comandas can be closed');
    }

    return Comanda.create({
      id: this.id,
      comandaNumber: this.comandaNumber,
      label: this.label,
      items: this.items,
      status: ComandaStatus.CLOSED,
      openedAt: this.openedAt,
      closedAt,
      notes: this.notes,
    });
  }

  private static calculateTotal(items: ComandaItem[]): number {
    return items
      .filter((item) => !item.canceledAt)
      .reduce((total, item) => total + item.totalPrice, 0);
  }
}
