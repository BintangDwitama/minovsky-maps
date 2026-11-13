import type { Clipboard } from '../application/ports';

/** navigator.clipboard, reporting failure (insecure context, denied permission) as false. */
export class BrowserClipboard implements Clipboard {
  async writeText(text: string): Promise<boolean> {
    try {
      if (!navigator.clipboard) return false;
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
}
