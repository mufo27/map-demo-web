declare module 'secure-web-storage' {
    interface SecureStorageOptions {
        hash?: (key: string) => string;
        encrypt?: (data: string) => string;
        decrypt?: (data: string) => string;
    }

    class SecureStorage {
        constructor(storage: Storage, options?: SecureStorageOptions);

        getItem(key: string): any;
        setItem(key: string, value: any): void;
        removeItem(key: string): void;
        clear(): void;
        key(index: number): string | null;
        get length(): number;
    }

    export default SecureStorage;
}
