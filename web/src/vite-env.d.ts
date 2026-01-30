/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PUBLIC_ELECTRIC_URL?: string;
  readonly VITE_ELECTRIC_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
