import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { Product } from '../../models/product.model';
import { PlnCurrencyPipe } from '../../pipes/pln-currency.pipe';

@Component({
  selector: 'app-product-details-page',
  imports: [RouterLink, PlnCurrencyPipe],
  templateUrl: './product-details.page.html',
})
export class ProductDetailsPage implements OnInit {
  private route = inject(ActivatedRoute);
  private productService = inject(ProductService);
  private cartService = inject(CartService);

  product = signal<Product | null>(null);
  isLoading = signal<boolean>(true);
  errorMsg = signal<string | null>(null);

  ngOnInit(): void {
    const rawId = this.route.snapshot.paramMap.get('id');
    const id = Number(rawId);

    if (!rawId || Number.isNaN(id) || id <= 0) {
      this.errorMsg.set('Nieprawidłowy identyfikator produktu.');
      this.isLoading.set(false);
      return;
    }

    this.productService.getProducts().subscribe({
      next: (items: Product[]) => {
        const found = items.find((p) => p.id === id) ?? null;
        if (!found) {
          this.errorMsg.set('Nie znaleziono produktu.');
        } else {
          this.product.set(found);
        }
        this.isLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMsg.set(err?.error?.message ?? 'Nie udało się pobrać produktu.');
        this.isLoading.set(false);
      },
    });
  }

  addToCart(): void {
    const current = this.product();
    if (!current) {
      return;
    }
    this.cartService.addProduct(current);
    window.dispatchEvent(
      new CustomEvent<string>('smartshop:notice', { detail: `Dodano do koszyka: ${current.name}` }),
    );
  }
}
