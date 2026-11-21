import { buildSeo } from '../_lib/metadata.js';
import { photoSocialImage } from '../_lib/social-images.js';

export default {
  seo: async (data) => {
    const photoPage = !data.seoExclude && /^\/photos\/.+\/$/.test(data.page?.url || '');
    const image = photoPage ? await photoSocialImage(data.page.inputPath) : undefined;
    return buildSeo(data, image);
  },
};
