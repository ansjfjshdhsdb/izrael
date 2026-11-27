import { cp, mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
for (const path of ['index.html', 'styles.css', 'portal.css', 'app.js', 'admin.js', 'media', 'data']) {
  await cp(path, `dist/${path}`, { recursive: true });
}
