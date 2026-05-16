// See https://svelte.dev/docs/kit/types#app
declare global {
  namespace App {
    interface Locals {
      sitePasswordEnabled: boolean;
      siteAuthenticated: boolean;
      goobyPasswordEnabled: boolean;
      goobyAuthenticated: boolean;
      rootAdminAuthenticated: boolean;
    }
  }
}

declare module 'suncalc';

export {};
