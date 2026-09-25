import { defineConfig } from 'vite';
import { appConfig, brandIcon } from '@feather/config/vite';

export default defineConfig(appConfig({ root: import.meta.dirname, port: 5173, plugins: [brandIcon()] }));
