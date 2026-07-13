export type ProductProps = {
  id?: string;
  name: string;
  description: string;
  price: number;
  active: boolean;
  category?: ProductCategory;
  imageUrl?: string;
};

export const PRODUCT_CATEGORIES = ['Espetos', 'Bebidas', 'Doces'] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const DEFAULT_PRODUCT_CATEGORY: ProductCategory = 'Espetos';

export const isProductCategory = (value: string): value is ProductCategory =>
  PRODUCT_CATEGORIES.includes(value as ProductCategory);

export class Product {
  private constructor(
    public readonly id: string | undefined,
    public readonly name: string,
    public readonly description: string,
    public readonly price: number,
    public readonly active: boolean,
    public readonly category: ProductCategory,
    public readonly imageUrl: string | undefined,
  ) {}

  static create(props: ProductProps): Product {
    if (props.name.trim() === '') {
      throw new Error('Product name is required');
    }

    if (props.description.trim() === '') {
      throw new Error('Product description is required');
    }

    if (!Number.isFinite(props.price)) {
      throw new Error('Product price must be a valid number');
    }

    if (props.price <= 0) {
      throw new Error('Product price must be greater than zero');
    }

    const category = props.category ?? DEFAULT_PRODUCT_CATEGORY;

    if (!isProductCategory(category)) {
      throw new Error('Product category is invalid');
    }

    const imageUrl = props.imageUrl?.trim() || undefined;

    if (imageUrl && !/^https?:\/\//.test(imageUrl)) {
      throw new Error('Product image URL must start with http:// or https://');
    }

    if (imageUrl && imageUrl.length > 1000) {
      throw new Error('Product image URL is too long');
    }

    return new Product(
      props.id,
      props.name,
      props.description,
      props.price,
      props.active,
      category,
      imageUrl,
    );
  }
}
