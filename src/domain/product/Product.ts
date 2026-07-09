export type ProductProps = {
  id?: string;
  name: string;
  description: string;
  price: number;
  active: boolean;
  imageUrl?: string;
};

export class Product {
  private constructor(
    public readonly id: string | undefined,
    public readonly name: string,
    public readonly description: string,
    public readonly price: number,
    public readonly active: boolean,
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
      imageUrl,
    );
  }
}
