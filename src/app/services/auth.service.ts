import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface LoginResponse {
  token: string;
  expiresAtUtc: string;
  email: string;
  role: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private authUrl = 'http://localhost:5089/api/auth';
  private readonly tokenKey = 'smartshop_admin_token';
  private readonly emailKey = 'smartshop_admin_email';

  private tokenSignal = signal<string | null>(this.readInitialToken());
  private emailSignal = signal<string | null>(localStorage.getItem(this.emailKey));

  token = this.tokenSignal.asReadonly();
  adminEmail = this.emailSignal.asReadonly();
  isAdmin = computed<boolean>(() => Boolean(this.tokenSignal()));

  private readInitialToken(): string | null {
    const rawToken = localStorage.getItem(this.tokenKey);
    const expiresAt = localStorage.getItem('smartshop_admin_expires');

    if (!rawToken) {
      return null;
    }

    if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
      this.clearStorage();
      return null;
    }

    return rawToken;
  }

  private clearStorage(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.emailKey);
    localStorage.removeItem('smartshop_admin_expires');
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.authUrl}/login`, { email, password }).pipe(
      tap((res) => {
        localStorage.setItem(this.tokenKey, res.token);
        localStorage.setItem(this.emailKey, res.email);
        localStorage.setItem('smartshop_admin_expires', res.expiresAtUtc);
        this.tokenSignal.set(res.token);
        this.emailSignal.set(res.email);
      }),
    );
  }

  logout(): void {
    this.clearStorage();
    this.tokenSignal.set(null);
    this.emailSignal.set(null);
  }
}
