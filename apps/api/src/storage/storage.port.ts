export const STORAGE_PORT = Symbol('STORAGE_PORT');

export interface StoragePort {
  save(key: string, buffer: Buffer, contentType: string): Promise<string>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}
