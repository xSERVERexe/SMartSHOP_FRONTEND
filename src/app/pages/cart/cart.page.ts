import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { OrderService } from '../../services/order.service';
import { PlnCurrencyPipe } from '../../pipes/pln-currency.pipe';

@Component({
  selector: 'app-cart-page',
  imports: [RouterLink, PlnCurrencyPipe],
  templateUrl: './cart.page.html',
})
export class CartPage {
  private router = inject(Router);
  private orderService = inject(OrderService);
  cartService = inject(CartService);
  authService = inject(AuthService);

  isPlacing = signal<boolean>(false);
  errorMsg = signal<string | null>(null);

  private notify(message: string): void {
    window.dispatchEvent(new CustomEvent<string>('smartshop:notice', { detail: message }));
  }

  placeOrder(): void {
    this.errorMsg.set(null);

    if (!this.authService.isLoggedIn()) {
      void this.router.navigate(['/login']);
      return;
    }

    const items = this.cartService.items();
    if (items.length === 0) {
      this.errorMsg.set('Koszyk jest pusty.');
      return;
    }

    this.isPlacing.set(true);

    this.orderService
      .createOrder({
        customerEmail: this.authService.userEmail() ?? undefined,
        items: items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
        })),
      })
      .subscribe({
        next: () => {
          this.isPlacing.set(false);
          this.cartService.clearCart();
          this.notify('Zamówienie zostało złożone.');
          void this.router.navigate(['/orders']);
        },
        error: (err) => {
          this.isPlacing.set(false);
          this.errorMsg.set(err?.error?.message ?? 'Nie udało się złożyć zamówienia.');
        },
      });
  }
}
