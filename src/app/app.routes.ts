import { Routes } from '@angular/router';
import { CatalogPage } from './pages/catalog/catalog.page';
import { ProductDetailsPage } from './pages/product-details/product-details.page';
import { CartPage } from './pages/cart/cart.page';
import { OrdersPage } from './pages/orders/orders.page';
import { LoginPage } from './pages/login/login.page';
import { RegisterPage } from './pages/register/register.page';

export const routes: Routes = [
  { path: '', component: CatalogPage, title: 'SMart SHOP' },
  { path: 'product/:id', component: ProductDetailsPage, title: 'SMart SHOP — Produkt' },
  { path: 'cart', component: CartPage, title: 'SMart SHOP — Koszyk' },
  { path: 'orders', component: OrdersPage, title: 'SMart SHOP — Zamówienia' },
  { path: 'login', component: LoginPage, title: 'SMart SHOP — Logowanie' },
  { path: 'register', component: RegisterPage, title: 'SMart SHOP — Rejestracja' },
  { path: '**', redirectTo: '' },
];
