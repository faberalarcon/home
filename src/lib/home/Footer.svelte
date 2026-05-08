<script lang="ts">
  import SiteFooter from '$lib/site/SiteFooter.svelte';
  import type { FooterData } from './content';

  export let footer: FooterData;
</script>

<SiteFooter
  visitorCount={footer.visitorCount}
  brand={footer.brand}
  location={footer.location}
  tagline={footer.tagline}
/>
