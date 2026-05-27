/// <reference types="@sveltejs/kit" />

declare const __APP_VERSION__: string;

declare module "*.svelte" {
  import type { SvelteComponent } from "svelte";

  export default SvelteComponent;
}
