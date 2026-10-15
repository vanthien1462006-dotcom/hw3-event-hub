const DELAY_MS = 1200;
const FAIL_SUFFIX = '@fail.test';

export function mockSubmit(payload) {
  console.info('[mock-api] request');

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const email = String(payload?.email ?? '').toLowerCase();

      if (email.endsWith(FAIL_SUFFIX)) {
        reject(new Error('Mock API rejected the request'));
        return;
      }

      resolve({ id: Math.random().toString(36).slice(2) });
    }, DELAY_MS);
  });
}
