import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ProductService } from './services/product.service';
import { CategoryService } from './services/category.service';
import { Product } from './models/product.model';
import { Category } from './models/category.model';

@Component({
  imports: [CurrencyPipe],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App implements OnInit {
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);

  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);

  searchQuery = signal<string>('');
  selectedCategory = signal<string>('ALL');

  categoryNames = computed<string[]>(() => {
    const fromApi = this.categories().map((c) => c.name);
    if (fromApi.length > 0) {
      return ['ALL', ...Array.from(new Set(fromApi))];
    }

    const fromProducts = this.products()
      .map((p) => p.categoryName)
      .filter((name): name is string => Boolean(name));
    return ['ALL', ...Array.from(new Set(fromProducts))];
  });

  filteredProducts = computed<Product[]>(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const category = this.selectedCategory();

    return this.products().filter((product) => {
      const matchesCategory = category === 'ALL' || product.categoryName === category;
      const matchesQuery =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query) ||
        product.categoryName.toLowerCase().includes(query);

      return matchesCategory && matchesQuery;
    });
  });

  ngOnInit(): void {
    this.categoryService.getCategories().subscribe({
      next: (data) => this.categories.set(data),
      error: (err) => console.error('Błąd pobierania kategorii:', err),
    });

    this.productService.getProducts().subscribe({
      next: (data) => {
        this.products.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Błąd pobierania produktów:', err);
        this.error.set('Nie udało się pobrać produktów.');
        this.isLoading.set(false);
      },
    });
  }

  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  selectCategory(category: string): void {
    this.selectedCategory.set(category);
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedCategory.set('ALL');
  }
}
