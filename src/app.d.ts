// See https://svelte.dev/docs/kit/types#app
declare global {
  namespace App {
    interface Locals {
      sitePasswordEnabled: boolean;
      siteAuthenticated: boolean;
      goobyPasswordEnabled: boolean;
      goobyAuthenticated: boolean;
      adminAuthenticated: boolean;
      drinkAdminAuthenticated: boolean;
      rootAdminAuthenticated: boolean;
    }
  }
}

declare module 'suncalc';

export {};
