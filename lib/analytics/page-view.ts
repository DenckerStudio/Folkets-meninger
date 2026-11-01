export type BuildPageViewBodyInput = {
  pathname: string;
  search: string;
  referrer: string;
};

export type PageViewCollectBody = {
  eventName: 'page_view';
  path: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  ref?: string;
  shareCode?: string;
};

function optionalQueryField(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key)?.trim();
  return value ? value : undefined;
}

/** Admin-trafikk telles ikke som offentlige sidevisninger. */
export function shouldTrackPath(pathname: string): boolean {
  return !pathname.startsWith('/dashboard/admin');
}

export function buildPageViewBody(input: BuildPageViewBodyInput): PageViewCollectBody {
  const params = new URLSearchParams(
    input.search.startsWith('?') ? input.search.slice(1) : input.search,
  );

  const body: PageViewCollectBody = {
    eventName: 'page_view',
    path: input.pathname,
  };

  const referrer = input.referrer.trim();
  if (referrer) {
    body.referrer = referrer;
  }

  const utmSource = optionalQueryField(params, 'utm_source');
  if (utmSource) {
    body.utm_source = utmSource;
  }
  const utmMedium = optionalQueryField(params, 'utm_medium');
  if (utmMedium) {
    body.utm_medium = utmMedium;
  }
  const utmCampaign = optionalQueryField(params, 'utm_campaign');
  if (utmCampaign) {
    body.utm_campaign = utmCampaign;
  }
  const ref = optionalQueryField(params, 'ref');
  if (ref) {
    body.ref = ref;
  }
  const shareCode = optionalQueryField(params, 'fm_share');
  if (shareCode) {
    body.shareCode = shareCode;
  }

  return body;
}
