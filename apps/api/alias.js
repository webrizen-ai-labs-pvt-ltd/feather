// Registers the `@/` import alias (→ src/) for Node. Loaded with `node --import ./alias.js`.
import { register } from 'node:module';

register('./alias-hooks.js', import.meta.url);
