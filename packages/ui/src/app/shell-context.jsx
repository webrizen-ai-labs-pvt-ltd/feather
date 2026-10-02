import { createContext, useContext } from 'react';

/** Lets pages tell the app shell what to show in the breadcrumb bar. */
export const ShellContext = createContext(null);
export const useShell = () => useContext(ShellContext);
