import type {
  ComandaListOptions,
  ComandaRepository,
} from '../../application/repositories/ComandaRepository';
import {
  Comanda,
  ComandaStatus,
  type ComandaItem,
} from '../../domain/comanda/Comanda';
import { Product } from '../../domain/product/Product';

type SupabaseQueryResult<T = unknown> = {
  data?: T;
  error?: Error | null;
};

type SupabaseClient = {
  from(table: string): unknown;
};

type ComandaRow = {
  id: string;
  comanda_number?: number | null;
  label: string;
  status: ComandaStatus;
  opened_at?: string | null;
  closed_at?: string | null;
  notes?: string | null;
};

type ComandaItemRow = {
  id: string;
  comanda_id: string;
  product_id?: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at?: string | null;
  canceled_at?: string | null;
};

export class SupabaseComandaRepository implements ComandaRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async save(comanda: Comanda): Promise<Comanda> {
    if (!comanda.id) {
      throw new Error('Comanda must have an id to be saved');
    }

    const comandasTable = this.supabase.from('comandas') as {
      insert: (row: unknown) => {
        select: (columns?: string) => {
          single: () => Promise<SupabaseQueryResult<unknown>>;
        };
      };
    };

    const result = await comandasTable
      .insert({
        id: comanda.id,
        label: comanda.label,
        status: comanda.status,
        opened_at: comanda.openedAt?.toISOString(),
        closed_at: comanda.closedAt?.toISOString(),
        notes: comanda.notes ?? null,
      })
      .select('*')
      .single();

    this.throwIfSupabaseError(result);

    return this.toDomain(result.data as ComandaRow, []);
  }

  async findById(id: string): Promise<Comanda | null> {
    const comandasTable = this.supabase.from('comandas') as {
      select: (columns?: string) => {
        eq: (
          field: string,
          value: string,
        ) => {
          maybeSingle: () => Promise<SupabaseQueryResult<unknown | null>>;
        };
      };
    };
    const itemsTable = this.supabase.from('comanda_items') as {
      select: (columns?: string) => {
        eq: (
          field: string,
          value: string,
        ) => Promise<SupabaseQueryResult<unknown[]>>;
      };
    };

    const comandaResult = await comandasTable
      .select('*')
      .eq('id', id)
      .maybeSingle();

    this.throwIfSupabaseError(comandaResult);

    if (!comandaResult.data) {
      return null;
    }

    const itemsResult = await itemsTable.select('*').eq('comanda_id', id);

    this.throwIfSupabaseError(itemsResult);

    return this.toDomain(
      comandaResult.data as ComandaRow,
      (itemsResult.data ?? []) as ComandaItemRow[],
    );
  }

  async findAll(options: ComandaListOptions = {}): Promise<Comanda[]> {
    const comandasTable = this.supabase.from('comandas') as {
      select: (columns?: string) => {
        in: (
          column: string,
          values: string[],
        ) => {
          order: (
            column: string,
            options: { ascending: boolean },
          ) => Promise<SupabaseQueryResult<unknown[]>>;
        };
        order: (
          column: string,
          options: { ascending: boolean },
        ) => Promise<SupabaseQueryResult<unknown[]>>;
      };
    };
    const itemsTable = this.supabase.from('comanda_items') as {
      select: (columns?: string) => {
        in: (
          column: string,
          values: string[],
        ) => Promise<SupabaseQueryResult<unknown[]>>;
      } & Promise<SupabaseQueryResult<unknown[]>>;
    };

    const comandasResult = options.statuses?.length
      ? await comandasTable
          .select('*')
          .in('status', options.statuses)
          .order('opened_at', { ascending: false })
      : await comandasTable
          .select('*')
          .order('opened_at', { ascending: false });

    this.throwIfSupabaseError(comandasResult);

    const comandaRows = (comandasResult.data ?? []) as ComandaRow[];

    if (comandaRows.length === 0) {
      return [];
    }

    const comandaIds = comandaRows.map((row) => row.id);
    const itemsResult = await itemsTable
      .select('*')
      .in('comanda_id', comandaIds);

    this.throwIfSupabaseError(itemsResult);

    const itemRows = (itemsResult.data ?? []) as ComandaItemRow[];

    return comandaRows.map((comandaRow) =>
      this.toDomain(
        comandaRow,
        itemRows.filter((itemRow) => itemRow.comanda_id === comandaRow.id),
      ),
    );
  }

  async addItem(
    comandaId: string,
    product: Product,
    quantity: number,
  ): Promise<Comanda> {
    if (!product.id) {
      throw new Error('Product must have an id to add to comanda');
    }

    if (!product.active) {
      throw new Error('Inactive product cannot be added to comanda');
    }

    if (quantity <= 0) {
      throw new Error('Comanda item quantity must be greater than zero');
    }

    const itemsTable = this.supabase.from('comanda_items') as {
      insert: (row: unknown) => Promise<SupabaseQueryResult>;
    };

    const result = await itemsTable.insert({
      comanda_id: comandaId,
      product_id: product.id,
      product_name: product.name,
      quantity,
      unit_price: product.price,
      total_price: product.price * quantity,
    });

    this.throwIfSupabaseError(result);

    return this.requireComanda(comandaId);
  }

  async cancelItem(comandaId: string, itemId: string): Promise<Comanda> {
    const itemsTable = this.supabase.from('comanda_items') as {
      update: (row: unknown) => {
        eq: (
          field: string,
          value: string,
        ) => Promise<SupabaseQueryResult>;
      };
    };

    const result = await itemsTable
      .update({
        canceled_at: new Date().toISOString(),
      })
      .eq('id', itemId);

    this.throwIfSupabaseError(result);

    return this.requireComanda(comandaId);
  }

  async close(comandaId: string): Promise<Comanda> {
    const comandasTable = this.supabase.from('comandas') as {
      update: (row: unknown) => {
        eq: (
          field: string,
          value: string,
        ) => Promise<SupabaseQueryResult>;
      };
    };

    const result = await comandasTable
      .update({
        status: ComandaStatus.CLOSED,
        closed_at: new Date().toISOString(),
      })
      .eq('id', comandaId);

    this.throwIfSupabaseError(result);

    return this.requireComanda(comandaId);
  }

  private async requireComanda(comandaId: string): Promise<Comanda> {
    const comanda = await this.findById(comandaId);

    if (!comanda) {
      throw new Error('Comanda not found');
    }

    return comanda;
  }

  private toDomain(row: ComandaRow, itemRows: ComandaItemRow[]): Comanda {
    return Comanda.create({
      id: row.id,
      comandaNumber: row.comanda_number ?? undefined,
      label: row.label,
      status: row.status,
      openedAt: row.opened_at ? new Date(row.opened_at) : undefined,
      closedAt: row.closed_at ? new Date(row.closed_at) : undefined,
      notes: row.notes ?? undefined,
      items: itemRows.map((itemRow) => this.toDomainItem(itemRow)),
    });
  }

  private toDomainItem(row: ComandaItemRow): ComandaItem {
    return {
      id: row.id,
      product: Product.create({
        id: row.product_id ?? undefined,
        name: row.product_name,
        description: row.product_name,
        price: Number(row.unit_price),
        active: true,
      }),
      quantity: row.quantity,
      unitPrice: Number(row.unit_price),
      totalPrice: Number(row.total_price),
      createdAt: row.created_at ? new Date(row.created_at) : undefined,
      canceledAt: row.canceled_at ? new Date(row.canceled_at) : undefined,
    };
  }

  private throwIfSupabaseError(result?: SupabaseQueryResult): void {
    if (result?.error) {
      throw result.error;
    }
  }
}
