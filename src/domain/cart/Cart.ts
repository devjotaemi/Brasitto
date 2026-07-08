import { Product } from '../product/Product';

export type CartItem = {
  product: Product;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export class Cart {
  private readonly cartItems: CartItem[] = [];

  get items(): CartItem[] {
    return [...this.cartItems];
  }

  addItem(product: Product, quantity: number): void {
    if (!product.active) {
      throw new Error('Inactive product cannot be added to cart');
    }

    if (quantity <= 0) {
      throw new Error('Cart item quantity must be greater than zero');
    }

    this.cartItems.push({
      product,
      quantity,
      unitPrice: product.price,
      totalPrice: product.price * quantity,
    });
  }

  subtotal(): number {
    return this.cartItems.reduce((total, item) => total + item.totalPrice, 0);
  }
}
