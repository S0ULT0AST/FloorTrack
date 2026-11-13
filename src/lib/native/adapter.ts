/**
 * Web implementations of device features. A later Capacitor wrapper can
 * replace this module for the camera, barcode scanner, and file picker
 * without rewriting the screens that call it.
 */
export const native = {
  platform: "web" as const,
  async pickFile(): Promise<File | null> {
    return null;
  },
};
