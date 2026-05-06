<script lang="ts">
  import HomePage from '$lib/home/HomePage.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<HomePage data={data} />
