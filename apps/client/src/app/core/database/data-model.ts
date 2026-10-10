export interface DataModel {
  $key: string;
  notFound?: boolean;
  /**
   * Set (never saved) on a copy read from this device's cache before the server answered. A
   * whole-document write must not be based on such a copy: it may be older than the server's.
   */
  fromCache?: true;
  version?: number;
}
