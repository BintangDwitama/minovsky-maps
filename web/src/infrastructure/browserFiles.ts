import type { FileWriter, ScenarioFileReader } from '../application/ports';

/** Opens the native file picker; reads dropped files. */
export class BrowserFileReader implements ScenarioFileReader {
  constructor(private readonly accept = '.json,application/json') {}

  pick(): Promise<string | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = this.accept;
      input.style.display = 'none';
      let settled = false;
      const done = (v: string | null) => {
        if (settled) return;
        settled = true;
        input.remove();
        resolve(v);
      };
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) return done(null);
        file.text().then(done, () => done(null));
      });
      input.addEventListener('cancel', () => done(null));
      document.body.appendChild(input);
      input.click();
    });
  }

  read(source: Blob): Promise<string> {
    return source.text();
  }
}

/** Triggers a browser download. */
export class DownloadFileWriter implements FileWriter {
  async write(fileName: string, data: Blob): Promise<void> {
    const url = URL.createObjectURL(data);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      // give the browser a moment to start the download before revoking
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
}
