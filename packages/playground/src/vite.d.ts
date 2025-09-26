/// <reference types="vite/client" />

interface ImportMetaEnv {
  // more custom env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
