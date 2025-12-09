import { Injectable } from '@angular/core';
import * as CryptoJS from 'crypto-js';
import SecureStorage from 'secure-web-storage';
import { environment } from '../../../environments/environment';

const SECRET_KEY = `${environment.keySecret}`;

/**
 * manage secure storage
 */
@Injectable({
    providedIn: 'root'
})
export class StorageService {

    constructor() { }
    public secureStorage = new SecureStorage(localStorage, {
        hash: function hash(key: any) {
            key = CryptoJS.SHA256(key);

            return key.toString();
        },
        encrypt: function encrypt(data: any) {
            data = CryptoJS.AES.encrypt(data, SECRET_KEY);
            data = data.toString();
            return data;
        },
        decrypt: function decrypt(data: any) {
            data = CryptoJS.AES.decrypt(data, SECRET_KEY);
            data = data.toString(CryptoJS.enc.Utf8);
            return data;
        }
    });

}
