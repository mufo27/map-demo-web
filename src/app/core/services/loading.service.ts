import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class LoadingService {
    private loadingSubject = new BehaviorSubject<boolean>(false);

    loading$ = this.loadingSubject.asObservable();

    private loadingTimeout: any;

    loadingOn() {
        this.loadingSubject.next(true);

        this.loadingTimeout = setTimeout(() => {
            this.loadingOff();
        }, 8000);
    }

    loadingOff() {
        clearTimeout(this.loadingTimeout);
        this.loadingSubject.next(false);
    }
}
