import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OrderService } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';
import { OrderResponse } from '../../models/order.model';
import { PlnCurrencyPipe } from '../../pipes/pln-currency.pipe';

@Component({
  selector: 'app-orders-page',
  imports: [DatePipe, RouterLink, PlnCurrencyPipe],
  templateUrl: './orders.page.html',
})
export class OrdersPage implements OnInit {
  private orderService = inject(OrderService);
  authService = inject(AuthService);

  orders = signal<OrderResponse[]>([]);
  isLoading = signal<boolean>(true);
  errorMsg = signal<string | null>(null);

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    if (!this.authService.isLoggedIn()) {
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.errorMsg.set(null);

    const request$ = this.authService.isAdmin()
      ? this.orderService.getOrders()
      : this.orderService.getMyOrders();

    request$.subscribe({
      next: (data) => {
        this.orders.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMsg.set(err?.error?.message ?? 'Nie udało się pobrać zamówień.');
      },
    });
  }
}
