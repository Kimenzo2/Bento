/** Vault entry returned from the Rust backend. */
export interface VaultEntry {
  id: string;
  site: string;
  username: string;
  password: string;
  notes: string;
  created: number;
  updated: number;
}
