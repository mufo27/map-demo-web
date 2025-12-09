import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { catchError, finalize, throwError } from 'rxjs';
import { InterceptorLoginService } from '../services/interceptor-login.service';
import { LoadingService } from '../services/loading.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);
    const interceptorLoginService = inject(InterceptorLoginService);
    const loadingService = inject(LoadingService);

    const authToken = authService.getAuthUser()?.jwt_token || '';

    const authReq = req.clone({
        setHeaders: {
            Authorization: `Bearer ${authToken}`,
        },
    });

    loadingService.loadingOn();

    return next(authReq).pipe(
        catchError((err: any) => {
            if (err instanceof HttpErrorResponse) {
                if (err.status === 401) {
                    interceptorLoginService.openModal();
                    console.error('Unauthorized request:', err);
                    authService.logout();
                } else {
                    console.error('HTTP error:', err);
                }
            } else {
                console.error('An error occurred:', err);
            }

            return throwError(() => err);
        }),
        finalize(() => {
            loadingService.loadingOff();
        })
    );
};
