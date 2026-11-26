import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProductService } from './services/product.service';
import { CategoryService } from './services/category.service';
import { AuthService } from './services/auth.service';
import { CartService } from './services/cart.service';
import { OrderService } from './services/order.service';
import { CreateProductRequest, Product } from './models/product.model';
import { Category } from './models/category.model';
import { OrderResponse } from './models/order.model';

@Component({
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App implements OnInit {
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);
  private orderService = inject(OrderService);
  private fb = inject(FormBuilder);
  authService = inject(AuthService);
  cartService = inject(CartService);

  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);

  isCartOpen = signal<boolean>(false);
  isPlacingOrder = signal<boolean>(false);
  cartError = signal<string | null>(null);

  orders = signal<OrderResponse[]>([]);
  isOrdersOpen = signal<boolean>(false);
  isLoadingOrders = signal<boolean>(false);
  ordersError = signal<string | null>(null);

  isAuthOpen = signal<boolean>(false);
  authMode = signal<'login' | 'register'>('login');
  isSubmittingAuth = signal<boolean>(false);
  authError = signal<string | null>(null);

  isFormOpen = signal<boolean>(false);
  editingProductId = signal<number | null>(null);
  deletingProductId = signal<number | null>(null);
  isSubmitting = signal<boolean>(false);
  submitError = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  searchQuery = signal<string>('');
  selectedCategory = signal<string>('ALL');

  authForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
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
    if (this.authService.isLoggedIn()) {
      this.loadOrders(false);
    }
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

  loadOrders(showSpinner = true): void {
    if (!this.authService.isLoggedIn()) {
      return;
    }

    if (showSpinner) {
      this.isLoadingOrders.set(true);
    }
    this.ordersError.set(null);

    const request$ = this.authService.isAdmin()
      ? this.orderService.getOrders()
      : this.orderService.getMyOrders();

    request$.subscribe({
      next: (data) => {
        this.orders.set(data);
        this.isLoadingOrders.set(false);
      },
      error: (err) => {
        console.error('Błąd pobierania zamówień:', err);
        this.ordersError.set('Nie udało się pobrać listy zamówień.');
        this.isLoadingOrders.set(false);
      },
    });
  }

  toggleOrdersPanel(): void {
    if (!this.authService.isLoggedIn()) {
      this.openAuthPanel('login');
      return;
    }

    const nextOpen = !this.isOrdersOpen();
    this.isOrdersOpen.set(nextOpen);
    if (nextOpen) {
      this.loadOrders();
    }
  }

  toggleCart(): void {
    this.cartError.set(null);
    this.isCartOpen.update((open) => !open);
  }

  addToCart(product: Product): void {
    this.cartError.set(null);
    this.cartService.addProduct(product);
    this.successMessage.set(`Dodano do koszyka: "${product.name}".`);
  }

  placeOrder(): void {
    if (!this.authService.isLoggedIn()) {
      this.cartError.set('Aby złożyć zamówienie, zaloguj się lub utwórz konto.');
      this.openAuthPanel('login');
      return;
    }

    const currentItems = this.cartService.items();
    if (currentItems.length === 0) {
      this.cartError.set('Koszyk jest pusty.');
      return;
    }

    this.cartError.set(null);
    this.isPlacingOrder.set(true);

    const payload = {
      customerEmail: this.authService.userEmail() ?? undefined,
      items: currentItems.map((i) => ({
        productId: i.product.id,
        quantity: i.quantity,
      })),
    };

    this.orderService.createOrder(payload).subscribe({
      next: (createdOrder) => {
        this.isPlacingOrder.set(false);
        this.cartService.clearCart();
        this.successMessage.set(
          `Złożono zamówienie #${createdOrder.id} (status: ${createdOrder.status}, suma: ${createdOrder.totalAmount.toFixed(2)} PLN).`,
        );

        if (this.authService.isLoggedIn()) {
          this.isOrdersOpen.set(true);
          this.loadOrders(false);
        }
      },
      error: (err) => {
        console.error('Błąd składania zamówienia:', err);
        if (err?.status === 401) {
          this.cartError.set(
            'Sesja wygasła lub brak konta. Zaloguj się ponownie, aby złożyć zamówienie.',
          );
          this.openAuthPanel('login');
        } else {
          this.cartError.set(
            err?.error?.message ??
              'Nie udało się złożyć zamówienia. Sprawdź koszyk i połączenie z API.',
          );
        }
        this.isPlacingOrder.set(false);
      },
    });
  }

  openAuthPanel(mode: 'login' | 'register' = 'login'): void {
    this.authError.set(null);
    this.authMode.set(mode);
    this.isAuthOpen.set(true);
  }

  toggleAuthPanel(): void {
    this.authError.set(null);
    this.isAuthOpen.update((open) => !open);
  }

  setAuthMode(mode: 'login' | 'register'): void {
    this.authError.set(null);
    this.authMode.set(mode);
  }

  onAuthSubmit(): void {
    this.authError.set(null);
    if (this.authForm.invalid) {
      this.authForm.markAllAsTouched();
      return;
    }

    const { email, password } = this.authForm.getRawValue();
    const cleanEmail = email.trim();
    const isRegister = this.authMode() === 'register';

    this.isSubmittingAuth.set(true);

    const request$ = isRegister
      ? this.authService.register(cleanEmail, password)
      : this.authService.login(cleanEmail, password);

    request$.subscribe({
      next: (res) => {
        this.isSubmittingAuth.set(false);
        this.isAuthOpen.set(false);
        this.cartError.set(null);
        this.authForm.reset();

        if (res.role === 'Admin') {
          this.successMessage.set(`Zalogowano jako administrator (${res.email}).`);
        } else {
          this.successMessage.set(
            isRegister
              ? `Utworzono konto i zalogowano jako ${res.email}.`
              : `Zalogowano jako ${res.email}.`,
          );
        }

        this.isOrdersOpen.set(true);
        this.loadOrders();
      },
      error: (err) => {
        console.error('Błąd autoryzacji:', err);
        this.authError.set(
          err?.error?.message ??
            (isRegister ? 'Nie udało się utworzyć konta.' : 'Nieprawidłowy e-mail lub hasło.'),
        );
        this.isSubmittingAuth.set(false);
      },
    });
  }

  logout(): void {
    this.authService.logout();
    this.closeProductForm();
    this.orders.set([]);
    this.isOrdersOpen.set(false);
    this.ordersError.set(null);
    this.successMessage.set('Wylogowano z konta.');
  }

  openCreateForm(): void {
    if (!this.authService.isAdmin()) {
      this.openAuthPanel('login');
      return;
    }

    this.submitError.set(null);
    this.editingProductId.set(null);
    const defaultCategoryId = this.categories()[0]?.id ?? 0;

    this.productForm.reset({
      name: '',
      description: '',
      price: 0,
      categoryId: defaultCategoryId,
    });
    this.isFormOpen.set(true);
  }

  startEdit(product: Product): void {
    if (!this.authService.isAdmin()) {
      this.openAuthPanel('login');
      return;
    }

    this.submitError.set(null);
    this.editingProductId.set(product.id);

    const matchedCategory = this.categories().find((c) => c.name === product.categoryName);
    const categoryId = matchedCategory?.id ?? this.categories()[0]?.id ?? 0;

    this.productForm.reset({
      name: product.name,
      description: product.description ?? '',
      price: product.price,
      categoryId,
    });
    this.isFormOpen.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  closeProductForm(): void {
    this.isFormOpen.set(false);
    this.editingProductId.set(null);
    this.submitError.set(null);
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
    const editingId = this.editingProductId();

    const request$ =
      editingId !== null
        ? this.productService.updateProduct(editingId, payload)
        : this.productService.createProduct(payload);

    request$.subscribe({
      next: (saved) => {
        this.isSubmitting.set(false);
        this.closeProductForm();
        this.successMessage.set(
          editingId !== null
            ? `Zaktualizowano produkt: "${saved.name}".`
            : `Dodano produkt: "${saved.name}".`,
        );

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
        console.error('Błąd zapisu produktu:', err);
        if (err?.status === 401 || err?.status === 403) {
          this.submitError.set('Brak autoryzacji administratora. Zaloguj się ponownie.');
        } else {
          this.submitError.set(
            err?.error?.message ?? 'Nie udało się zapisać produktu. Sprawdź poprawność danych.',
          );
        }
        this.isSubmitting.set(false);
      },
    });
  }

  deleteProduct(product: Product): void {
    if (!this.authService.isAdmin()) {
      this.openAuthPanel('login');
      return;
    }

    const confirmed = window.confirm(`Czy na pewno chcesz usunąć produkt "${product.name}"?`);
    if (!confirmed) {
      return;
    }

    this.submitError.set(null);
    this.successMessage.set(null);
    this.deletingProductId.set(product.id);

    this.productService.deleteProduct(product.id).subscribe({
      next: () => {
        this.deletingProductId.set(null);
        if (this.editingProductId() === product.id) {
          this.closeProductForm();
        }
        this.cartService.removeItem(product.id);
        this.products.update((list) => list.filter((p) => p.id !== product.id));
        this.successMessage.set(`Usunięto produkt: "${product.name}".`);
      },
      error: (err) => {
        console.error('Błąd usuwania produktu:', err);
        this.deletingProductId.set(null);
        if (err?.status === 401 || err?.status === 403) {
          this.submitError.set('Brak autoryzacji administratora. Zaloguj się ponownie.');
        } else if (err?.status === 404) {
          this.submitError.set('Produkt nie istnieje już w bazie.');
          this.loadProducts(false);
        } else {
          this.submitError.set(err?.error?.message ?? 'Nie udało się usunąć produktu.');
        }
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
