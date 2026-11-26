import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface AuthSession {
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
  private apiUrl = 'http://localhost:5089/api/auth';

  private readonly tokenKey = 'smartshop_jwt_token';
  private readonly emailKey = 'smartshop_user_email';
  private readonly roleKey = 'smartshop_user_role';
  private readonly expiresKey = 'smartshop_jwt_expires';

  token = signal<string | null>(this.readValidToken());
  userEmail = signal<string | null>(this.readValidToken() ? localStorage.getItem(this.emailKey) : null);
  userRole = signal<string | null>(this.readValidToken() ? localStorage.getItem(this.roleKey) : null);

  isLoggedIn = computed<boolean>(() => Boolean(this.token()));
  isAdmin = computed<boolean>(() => this.isLoggedIn() && this.userRole() === 'Admin');

  login(email: string, password: string): Observable<AuthSession> {
    return this.http
      .post<AuthSession>(`${this.apiUrl}/login`, { email, password })
      .pipe(tap((res) => this.saveSession(res)));
  }

  register(email: string, password: string): Observable<AuthSession> {
    return this.http
      .post<AuthSession>(`${this.apiUrl}/register`, { email, password })
      .pipe(tap((res) => this.saveSession(res)));
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.emailKey);
    localStorage.removeItem(this.roleKey);
    localStorage.removeItem(this.expiresKey);
    this.token.set(null);
    this.userEmail.set(null);
    this.userRole.set(null);
  }

  private saveSession(res: AuthSession): void {
    localStorage.setItem(this.tokenKey, res.token);
    localStorage.setItem(this.emailKey, res.email);
    localStorage.setItem(this.roleKey, res.role);
    localStorage.setItem(this.expiresKey, res.expiresAtUtc);
    this.token.set(res.token);
    this.userEmail.set(res.email);
    this.userRole.set(res.role);
  }

  private readValidToken(): string | null {
    const token = localStorage.getItem(this.tokenKey);
    if (!token) {
      return null;
    }

    const expiresRaw = localStorage.getItem(this.expiresKey);
    if (expiresRaw) {
      const expiresMs = Date.parse(expiresRaw);
      if (!Number.isNaN(expiresMs) && expiresMs <= Date.now()) {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.emailKey);
        localStorage.removeItem(this.roleKey);
        localStorage.removeItem(this.expiresKey);
        return null;
      }
    }

    return token;
  }
}