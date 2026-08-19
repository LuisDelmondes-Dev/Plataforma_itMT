import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(webRoot, 'node_modules', 'cesium', 'Build', 'Cesium');
const destination = join(webRoot, 'public', 'cesium');

await mkdir(destination, { recursive: true });
await Promise.all(['Assets', 'ThirdParty', 'Widgets', 'Workers'].map((name) =>
  cp(join(source, name), join(destination, name), { recursive: true, force: true }),
));
