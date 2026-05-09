<script lang="ts">
  import SharedSectionHeader from '$lib/components/SectionHeader.svelte';

  let {
    title,
    meta = ''
  }: {
    title: string;
    meta?: string;
  } = $props();
</script>

<SharedSectionHeader {title} eyebrow={meta} compact />
