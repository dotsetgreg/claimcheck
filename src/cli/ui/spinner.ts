/**
 * Spinner for progress indication
 */

import ora, { type Ora } from 'ora';

let spinner: Ora | null = null;

export function startSpinner(text: string): void {
  spinner = ora(text).start();
}

export function updateSpinner(text: string): void {
  if (spinner) {
    spinner.text = text;
  }
}

export function succeedSpinner(text?: string): void {
  if (spinner) {
    spinner.succeed(text);
    spinner = null;
  }
}

export function failSpinner(text?: string): void {
  if (spinner) {
    spinner.fail(text);
    spinner = null;
  }
}

export function stopSpinner(): void {
  if (spinner) {
    spinner.stop();
    spinner = null;
  }
}
