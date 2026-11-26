import { Injectable, computed, effect, signal } from '@angular/core';
import { CartItem } from '../models/cart.model';
import { Product } from '../models/product.model';

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private readonly storageKey = 'smartshop_cart_v1';
  private itemsSignal = signal<CartItem[]>(this.readFromStorage());

  items = this.itemsSignal.asReadonly();

  totalCount = computed<number>(() =>
    this.itemsSignal().reduce((acc, item) => acc + item.quantity, 0),
  );

  totalAmount = computed<number>(() =>
    this.itemsSignal().reduce((acc, item) => acc + item.product.price * item.quantity, 0),
  );

  constructor() {
    effect(() => {
      localStorage.setItem(this.storageKey, JSON.stringify(this.itemsSignal()));
    });
  }

  private readFromStorage(): CartItem[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter(
        (entry): entry is CartItem =>
          entry &&
          typeof entry.quantity === 'number' &&
          entry.quantity > 0 &&
          entry.product &&
          typeof entry.product.id === 'number' &&
          typeof entry.product.price === 'number',
      );
    } catch {
      return [];
    }
  }

  addProduct(product: Product, amount = 1): void {
    if (amount <= 0) {
      return;
    }

    this.itemsSignal.update((current) => {
      const existingIndex = current.findIndex((i) => i.product.id === product.id);
      if (existingIndex === -1) {
        return [...current, { product, quantity: amount }];
      }

      return current.map((item, idx) =>
        idx === existingIndex ? { ...item, quantity: item.quantity + amount } : item,
      );
    });
  }

  increment(productId: number): void {
    this.itemsSignal.update((current) =>
      current.map((item) =>
        item.product.id === productId ? { ...item, quantity: item.quantity + 1 } : item,
      ),
    );
  }

  decrement(productId: number): void {
    this.itemsSignal.update((current) =>
      current
        .map((item) =>
          item.product.id === productId ? { ...item, quantity: item.quantity - 1 } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  removeItem(productId: number): void {
    this.itemsSignal.update((current) => current.filter((item) => item.product.id !== productId));
  }

  clearCart(): void {
    this.itemsSignal.set([]);
  }
}
