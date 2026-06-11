export type TabSection = {
  href: string;
  label: string;
};

type AppPaths = {
  /** Section list in swipe order. Sections without a page component fall back to full navigation. */
  sections: TabSection[];
  sectionIndexForPath(pathname: string): number;
  /** Map a section-relative href (e.g. '/menu') to a site path (e.g. '/drinks/menu'). */
  appPath(path?: string): string;
  /** Map a site pathname back to a section-relative one. */
  routePath(pathname: string): string;
};

export type TabShellConfig = AppPaths & {
  cacheTtlMs: number;
  /** CustomEvent name dispatched by the matching SwipeEnhancer. */
  navEventName: string;
  /** Anchors whose clicks the shell intercepts for instant tab switches. */
  navAnchorSelector: string;
  /** Section href -> page component. Keys define which hrefs the shell can render itself. */
  pageComponents: Record<string, any>;
};

export type SwipeEnhancerConfig = AppPaths & {
  navEventName: string;
  /** Joined selector for elements where a touch must not start a swipe. */
  interactiveSelector: string;
  /** The element cloned into swipe previews, both live and in fetched HTML. */
  mainSelector: string;
  overlayClass: string;
  pageClass: string;
  draggingBodyClass: string;
  /**
   * When set, the overlay is built immediately with this placeholder and the
   * preview is patched in as it loads. When unset, a swipe only gets an overlay
   * once a preview is cached (it is requested on first movement).
   */
  placeholderHtml?: string;
  /**
   * Fixed-header mode: offset the overlay below the header (CSS var with
   * selector fallback) and wrap pages in a `${pageClass}__content` element.
   */
  headerHeightVar?: string;
  fixedHeaderSelector?: string;
  /** Optional idle-time server warmup (POST {hrefs} to appPath(warmupPath)). */
  buildWarmupHrefs?(url: URL, data: Record<string, unknown>): string[];
  warmupPath?: string;
};
