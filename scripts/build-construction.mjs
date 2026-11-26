import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '_site');
// Fallback holding page. Only this generated directory is cleared; all site content remains in Git.
await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, 'css'), { recursive: true });
await mkdir(path.join(output, 'fonts'), { recursive: true });
for (const name of ['index.html', '404.html']) {
  await cp(path.join(root, 'construction', name), path.join(output, name));
}
await cp(path.join(root, 'construction/styles.css'), path.join(output, 'css/construction.css'));
await cp(path.join(root, 'public/fonts/MonaspaceNeonVar.woff2'), path.join(output, 'fonts/MonaspaceNeonVar.woff2'));
await cp(path.join(root, 'public/favicon.svg'), path.join(output, 'favicon.svg'));
await cp(path.join(root, 'CNAME'), path.join(output, 'CNAME'));
await cp(path.join(root, '.nojekyll'), path.join(output, '.nojekyll'));
console.log('Built the construction page. Deploy it only by switching the production build to build:construction.');
