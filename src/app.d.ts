// See https://svelte.dev/docs/kit/types#app
declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      sitePasswordEnabled: boolean;
      siteAuthenticated: boolean;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
