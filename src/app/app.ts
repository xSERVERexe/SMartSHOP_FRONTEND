import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProductService } from './services/product.service';
import { CategoryService } from './services/category.service';
import { CreateProductRequest, Product } from './models/product.model';
import { Category } from './models/category.model';

@Component({
  imports: [CurrencyPipe, ReactiveFormsModule],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App implements OnInit {
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);
  private fb = inject(FormBuilder);

  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);

  isFormOpen = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);
  submitError = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  searchQuery = signal<string>('');
  selectedCategory = signal<string>('ALL');

  productForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', [Validators.maxLength(500)]],
    price: [0, [Validators.required, Validators.min(0.01), Validators.max(1000000)]],
    categoryId: [0, [Validators.required, Validators.min(1)]],
  });

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
    this.loadCategories();
    this.loadProducts();
  }

  private loadCategories(): void {
    this.categoryService.getCategories().subscribe({
      next: (data) => {
        this.categories.set(data);
        if (data.length > 0 && this.productForm.controls.categoryId.value === 0) {
          this.productForm.controls.categoryId.setValue(data[0].id);
        }
      },
      error: (err) => console.error('Błąd pobierania kategorii:', err),
    });
  }

  private loadProducts(showSpinner = true): void {
    if (showSpinner) {
      this.isLoading.set(true);
    }

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

  toggleForm(): void {
    this.submitError.set(null);
    this.isFormOpen.update((open) => !open);
  }

  onSubmit(): void {
    this.submitError.set(null);
    this.successMessage.set(null);

    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    const raw = this.productForm.getRawValue();
    const payload: CreateProductRequest = {
      name: raw.name.trim(),
      description: raw.description.trim(),
      price: Number(raw.price),
      categoryId: Number(raw.categoryId),
    };

    this.isSubmitting.set(true);

    this.productService.createProduct(payload).subscribe({
      next: (created) => {
        this.isSubmitting.set(false);
        this.isFormOpen.set(false);
        this.successMessage.set(`Dodano produkt: "${created.name}".`);

        const defaultCategoryId = this.categories()[0]?.id ?? 0;
        this.productForm.reset({
          name: '',
          description: '',
          price: 0,
          categoryId: defaultCategoryId,
        });

        this.loadProducts(false);
      },
      error: (err) => {
        console.error('Błąd dodawania produktu:', err);
        this.submitError.set(
          err?.error?.message ?? 'Nie udało się dodać produktu. Sprawdź poprawność danych.',
        );
        this.isSubmitting.set(false);
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
