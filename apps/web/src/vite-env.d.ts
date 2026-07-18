/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_DEMO_CASE_ID?: string;
  readonly VITE_STATIC_DEMO?: string;
  readonly VITE_GLOBE_TEX_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
