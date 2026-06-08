/// <reference types="vite/client" />

declare module "*.js?raw" {
  const source: string;
  export default source;
}

declare module "*.json?raw" {
  const source: string;
  export default source;
}
