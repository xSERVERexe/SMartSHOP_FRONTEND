import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProductService } from './services/product.service';
import { CategoryService } from './services/category.service';
import { AuthService } from './services/auth.service';
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
  authService = inject(AuthService);

  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);

  isLoginOpen = signal<boolean>(false);
  isLoggingIn = signal<boolean>(false);
  loginError = signal<string | null>(null);

  isFormOpen = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);
  submitError = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  searchQuery = signal<string>('');
  selectedCategory = signal<string>('ALL');

  loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

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
        this.error.set('Nie udało się pobrać produktów. Sprawdź, czy backend jest uruchomiony.');
        this.isLoading.set(false);
      },
    });
  }

  toggleLoginPanel(): void {
    this.loginError.set(null);
    this.isLoginOpen.update((open) => !open);
  }

  onLoginSubmit(): void {
    this.loginError.set(null);
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { email, password } = this.loginForm.getRawValue();
    this.isLoggingIn.set(true);

    this.authService.login(email.trim(), password).subscribe({
      next: (res) => {
        this.isLoggingIn.set(false);
        this.isLoginOpen.set(false);
        this.loginForm.reset();
        this.successMessage.set(`Zalogowano jako administrator (${res.email}).`);
      },
      error: (err) => {
        console.error('Błąd logowania:', err);
        this.loginError.set(err?.error?.message ?? 'Nieprawidłowy e-mail lub hasło.');
        this.isLoggingIn.set(false);
      },
    });
  }

  logout(): void {
    this.authService.logout();
    this.isFormOpen.set(false);
    this.submitError.set(null);
    this.successMessage.set('Wylogowano z konta administratora.');
  }

  toggleForm(): void {
    if (!this.authService.isAdmin()) {
      this.isLoginOpen.set(true);
      return;
    }
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
        if (err?.status === 401 || err?.status === 403) {
          this.submitError.set('Brak autoryzacji administratora. Zaloguj się ponownie.');
        } else {
          this.submitError.set(
            err?.error?.message ?? 'Nie udało się dodać produktu. Sprawdź poprawność danych.',
          );
        }
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
