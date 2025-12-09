import { Injectable, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class InterceptorLoginService {
    private interceptorLoginModalSubject = new BehaviorSubject<boolean>(false);

    interceptorLoginModal$ = this.interceptorLoginModalSubject.asObservable();

    openModal() {
        // console.log('openModal');
        this.interceptorLoginModalSubject.next(true);
    }

    closeModal() {
        // console.log('closeModal');
        this.interceptorLoginModalSubject.next(false);
    }
}
