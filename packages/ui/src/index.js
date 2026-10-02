/**
 * @feather/ui — the one place apps import UI from.
 *  - Feather components (app/*) built on Untitled UI
 *  - the most used Untitled UI React primitives, re-exported
 *  - API client, auth, data hooks, help centre
 * Anything else from Untitled UI: import from '@uui/components/...'.
 */

// Feather components
export * from './app/basics.jsx';
export * from './app/forms.jsx';
export * from './app/overlays.jsx';
export * from './app/data.jsx';
export * from './app/domain.jsx';
export * from './app/tracking.jsx';
export { AppShell } from './app/shell.jsx';
export { useShell } from './app/shell-context.jsx';

// Untitled UI React primitives
export { Button } from '@uui/components/base/buttons/button';
export { ButtonUtility } from '@uui/components/base/buttons/button-utility';
export { Badge, BadgeWithDot, BadgeWithIcon } from '@uui/components/base/badges/badges';
export { Avatar } from '@uui/components/base/avatar/avatar';
export { Tooltip, TooltipTrigger } from '@uui/components/base/tooltip/tooltip';
export { Dropdown } from '@uui/components/base/dropdown/dropdown';
export { FeaturedIcon } from '@uui/components/foundations/featured-icon/featured-icon';
export { ProgressBar } from '@uui/components/base/progress-indicators/progress-indicators';
export { LoadingIndicator } from '@uui/components/application/loading-indicator/loading-indicator';
export { Table, TableCard } from '@uui/components/application/table/table';
export { ThemeProvider, useTheme } from '@uui/providers/theme-provider';
export { RouteProvider } from '@uui/providers/router-provider';
export { cx } from '@uui/utils/cx';

// Data, auth, media
export { ApiError, createApi } from './lib/api.js';
export { AuthProvider, RequireRole, useApi, useAuth } from './lib/auth.jsx';
export { compressImage, getPosition, newId } from './lib/media.js';
export { toOptions, useAction, useGet } from './lib/query.js';

// Help centre
export { HelpCenter } from './help/HelpCenter.jsx';
export { HelpLink } from './help/HelpLink.jsx';
export { HELP_GROUPS, HELP_SECTIONS, sectionsFor } from './help/content.jsx';
