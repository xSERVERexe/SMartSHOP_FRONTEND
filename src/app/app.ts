import { Component, OnDestroy, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';
import { CartService } from './services/cart.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
})
export class App implements OnDestroy {
  private router = inject(Router);
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  authService = inject(AuthService);
  cartService = inject(CartService);
  notice = signal<string | null>(null);

  constructor() {
    window.addEventListener('smartshop:notice', this.onNotice as EventListener);
  }

  ngOnDestroy(): void {
    window.removeEventListener('smartshop:notice', this.onNotice as EventListener);
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
    }
  }

  private onNotice = (event: Event): void => {
    const message = (event as CustomEvent<string>).detail;
    if (!message) {
      return;
    }

    this.notice.set(message);

    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
    }

    this.hideTimer = setTimeout(() => {
      this.notice.set(null);
      this.hideTimer = null;
    }, 2800);
  };

  private notify(message: string): void {
    window.dispatchEvent(new CustomEvent<string>('smartshop:notice', { detail: message }));
  }

  dismissNotice(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.notice.set(null);
  }

  logout(): void {
    this.authService.logout();
    this.notify('Wylogowano z konta.');
    void this.router.navigate(['/']);
  }
}
