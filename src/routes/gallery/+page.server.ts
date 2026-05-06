import { getFooterData } from '$lib/home/content';

export const load = async () => {
  return {
    footer: getFooterData(),
    meta: {
      title: 'Gallery | 21 Bristoe',
      description: 'A photo gallery from 21 Bristoe — Meades Crossing, Taneytown, Maryland.',
      canonicalUrl: 'https://21bristoe.com/gallery'
    }
  };
};
