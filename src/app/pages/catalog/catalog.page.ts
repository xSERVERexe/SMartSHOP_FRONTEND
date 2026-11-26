import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProductService } from '../../services/product.service';
import { CategoryService } from '../../services/category.service';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { CreateProductRequest, Product } from '../../models/product.model';
import { Category } from '../../models/category.model';
import { PlnCurrencyPipe } from '../../pipes/pln-currency.pipe';

@Component({
  selector: 'app-catalog-page',
  imports: [RouterLink, ReactiveFormsModule, PlnCurrencyPipe],
  templateUrl: './catalog.page.html',
})
export class CatalogPage implements OnInit {
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);
  private fb = inject(FormBuilder);
  authService = inject(AuthService);
  cartService = inject(CartService);

  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);

  searchQuery = signal<string>('');
  selectedCategory = signal<string>('ALL');

  readonly pageSize = 6;
  currentPage = signal<number>(1);

  isFormOpen = signal<boolean>(false);
  editingProductId = signal<number | null>(null);
  deletingProductId = signal<number | null>(null);
  isSubmitting = signal<boolean>(false);
  formError = signal<string | null>(null);

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

    return this.products().filter((p) => {
      const matchesCategory = category === 'ALL' || p.categoryName === category;
      const matchesQuery =
        !query ||
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.categoryName.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  });

  totalPages = computed<number>(() => {
    const count = this.filteredProducts().length;
    return Math.max(1, Math.ceil(count / this.pageSize));
  });

  pageNumbers = computed<number[]>(() => {
    return Array.from({ length: this.totalPages() }, (_, idx) => idx + 1);
  });

  pagedProducts = computed<Product[]>(() => {
    const safePage = Math.min(Math.max(1, this.currentPage()), this.totalPages());
    const start = (safePage - 1) * this.pageSize;
    return this.filteredProducts().slice(start, start + this.pageSize);
  });

  constructor() {
    effect(() => {
      this.searchQuery();
      this.selectedCategory();
      this.currentPage.set(1);
    });

    effect(() => {
      const maxPage = this.totalPages();
      if (this.currentPage() > maxPage) {
        this.currentPage.set(maxPage);
      }
    });
  }

  ngOnInit(): void {
    this.loadCategories();
    this.loadProducts();
  }

  private notify(message: string): void {
    window.dispatchEvent(new CustomEvent<string>('smartshop:notice', { detail: message }));
  }

  private loadCategories(): void {
    this.categoryService.getCategories().subscribe({
      next: (data) => {
        this.categories.set(data);
        if (data.length > 0 && this.productForm.controls.categoryId.value === 0) {
          this.productForm.controls.categoryId.setValue(data[0].id);
        }
      },
      error: () => {},
    });
  }

  loadProducts(showSpinner = true): void {
    if (showSpinner) {
      this.isLoading.set(true);
    }
    this.error.set(null);

    this.productService.getProducts().subscribe({
      next: (data) => {
        this.products.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Nie udało się pobrać produktów z serwera.');
        this.isLoading.set(false);
      },
    });
  }

  addToCart(product: Product): void {
    this.cartService.addProduct(product);
    this.notify(`Dodano do koszyka: ${product.name}`);
  }

  openCreateForm(): void {
    this.formError.set(null);
    this.editingProductId.set(null);
    this.productForm.reset({
      name: '',
      description: '',
      price: 0,
      categoryId: this.categories()[0]?.id ?? 0,
    });
    this.isFormOpen.set(true);
  }

  startEdit(product: Product): void {
    this.formError.set(null);
    this.editingProductId.set(product.id);
    const matched = this.categories().find((c) => c.name === product.categoryName);
    this.productForm.reset({
      name: product.name,
      description: product.description ?? '',
      price: product.price,
      categoryId: matched?.id ?? this.categories()[0]?.id ?? 0,
    });
    this.isFormOpen.set(true);
  }

  closeForm(): void {
    this.isFormOpen.set(false);
    this.editingProductId.set(null);
    this.formError.set(null);
  }

  submitProduct(): void {
    this.formError.set(null);
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
        this.closeForm();
        this.notify(editingId !== null ? `Zaktualizowano: ${saved.name}` : `Dodano: ${saved.name}`);
        this.loadProducts(false);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.formError.set(err?.error?.message ?? 'Nie udało się zapisać produktu.');
      },
    });
  }

  deleteProduct(product: Product): void {
    if (!window.confirm(`Usunąć produkt "${product.name}"?`)) {
      return;
    }
    this.deletingProductId.set(product.id);
    this.productService.deleteProduct(product.id).subscribe({
      next: () => {
        this.deletingProductId.set(null);
        this.cartService.removeItem(product.id);
        this.products.update((list) => list.filter((p) => p.id !== product.id));
        this.notify(`Usunięto: ${product.name}`);
      },
      error: (err) => {
        this.deletingProductId.set(null);
        this.error.set(err?.error?.message ?? 'Nie udało się usunąć produktu.');
      },
    });
  }

  goToPage(page: number): void {
    const target = Math.min(Math.max(1, page), this.totalPages());
    this.currentPage.set(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onSearchChange(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  selectCategory(category: string): void {
    this.selectedCategory.set(category);
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedCategory.set('ALL');
  }
}
