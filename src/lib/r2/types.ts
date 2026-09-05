/** Storage abstraction shared by the real R2-backed client and the local mock-mode fallback. */
export interface ObjectStore {
  putObject(key: string, body: Uint8Array, contentType: string): Promise<void>;
  getObject(key: string): Promise<Uint8Array>;
  deleteObject(key: string): Promise<void>;
  getSignedReadUrl(key: string, expiresSeconds?: number): Promise<string>;
  getSignedUploadUrl(key: string, contentType: string, expiresSeconds?: number): Promise<string>;
}
