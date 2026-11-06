/**
 * API v1 data shapes used by the app.
 *
 * These types MIRROR packages/contracts/src/schemas.ts (Zod, the single source of truth) and
 * docs/API.md. The mobile app is outside the pnpm workspace so it cannot import that package:
 * when the contracts change, update this file to match.
 */

export type PublicId = string; // 10 lowercase Crockford base32 chars
export type IsoDate = string;

export interface ImageVariant { width: number; url: string; format: 'avif' | 'webp' | 'jpeg' }
export interface ImageRef {
  id: string;
  url: string;
  width: number;
  height: number;
  alt: string;
  caption?: string;
  credit?: string;
  variants?: ImageVariant[];
}

export interface CategoryRef { id: string; slug: string; name: string; parentSlug: string | null }
export interface TagRef { slug: string; name: string }
export interface AuthorRef {
  id: string;
  slug: string;
  name: string;
  role?: string;
  avatar?: ImageRef;
  credit?: 'author' | 'contributor' | 'photographer' | 'editor';
}

export type Mark = 'bold' | 'italic' | 'underline' | 'strike' | 'code' | 'superscript' | 'subscript';
export type Inline =
  | { type: 'text'; text: string; marks?: Mark[] }
  | { type: 'link'; href: string; text: string; internalArticleId?: PublicId }
  | { type: 'linebreak' };

export type VideoProvider = 'stream' | 'youtube' | 'vimeo' | 'file';
export type EmbedProvider = 'x' | 'facebook' | 'instagram' | 'tiktok' | 'datawrapper' | 'iframe';

export type Block =
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'heading'; level: 2 | 3 | 4; children: Inline[] }
  | { type: 'quote'; children: Inline[]; attribution?: string }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'image'; image: ImageRef }
  | { type: 'gallery'; images: ImageRef[]; caption?: string }
  | { type: 'video'; provider: VideoProvider; videoId: string; url?: string; title: string; poster?: ImageRef }
  | { type: 'embed'; provider: EmbedProvider; url: string; html?: string }
  | { type: 'table'; caption?: string; header: string[]; rows: string[][] }
  | { type: 'related'; articleIds: PublicId[] }
  | { type: 'ad_slot'; slot: string }
  | { type: 'newsletter_prompt'; list: string };

export type ContentType = 'news' | 'analysis' | 'opinion' | 'investigation' | 'explainer' | 'live' | 'video' | 'podcast' | 'sponsored';
export type Label = 'breaking' | 'exclusive' | 'developing' | 'live' | 'fact_check' | 'sponsored';

export interface Correction { at: IsoDate; note: string }

export interface ArticleSummary {
  id: PublicId;
  url: string;
  path: string;
  type: ContentType;
  labels: Label[];
  headline: string;
  standfirst?: string;
  category: CategoryRef;
  authors: AuthorRef[];
  image?: ImageRef;
  publishedAt: IsoDate;
  updatedAt: IsoDate;
  readingTimeMinutes: number;
  location?: { name: string; lat: number; lng: number };
  video?: { provider: VideoProvider; id: string; url?: string; durationSeconds?: number };
  /** demonstration content — must be labelled "Demo" in every UI */
  isDemo: boolean;
  /** present for live coverage (type 'live'): show LIVE only while state = 'live', ENDED afterwards */
  live?: LiveSummaryState;
}

export interface LiveSummaryState { state: LiveState; startedAt: IsoDate | null; endedAt: IsoDate | null; archived: boolean }
export type LiveState = 'live' | 'ended';

export interface Article extends ArticleSummary {
  subheadline?: string;
  body: Block[];
  tags: TagRef[];
  sources: { label: string; url?: string }[];
  corrections: Correction[];
  /** monotonically increasing; compared to decide whether an offline copy is stale */
  revision: number;
  canonicalUrl: string;
  seo: { title: string; description: string; ogImage?: string; noindex?: boolean };
  sponsor?: { name: string; disclosure: string };
  /**
   * Live coverage state. `state`/`feedUrl`/`startedAt`/`endedAt`/`archived` may be missing in offline copies
   * saved by app versions released before live coverage (they only stored `status` + `updatesUrl`).
   */
  live?: {
    status: LiveState;
    state: LiveState;
    updatesUrl: string;
    feedUrl: string;
    startedAt: IsoDate | null;
    endedAt: IsoDate | null;
    archived: boolean;
  };
  /** stories the editors linked to this one ("Related coverage"); absent in copies saved by older app versions */
  relatedArticles?: ArticleSummary[];
}

export interface Tombstone { id: PublicId; state: 'withdrawn'; withdrawnAt: IsoDate; notice: string }

export interface LiveUpdate {
  id: string;
  articleId: PublicId;
  at: IsoDate;
  pinned: boolean;
  headline?: string;
  /** body media URLs are absolute */
  body: Block[];
  /** set when an editor changed the update after publishing it */
  updatedAt?: IsoDate;
  author?: { name: string; slug?: string };
}

/** A live coverage card: ongoing (state 'live'), ended, or ended + archived. Separate from breaking alerts. */
export interface LiveCoverage {
  id: PublicId;
  url: string;
  path: string;
  headline: string;
  standfirst?: string;
  category: { slug: string; name: string };
  image?: ImageRef;
  state: LiveState;
  archived: boolean;
  startedAt: IsoDate | null;
  endedAt: IsoDate | null;
  lastUpdateAt: IsoDate | null;
  updateCount: number;
  latestUpdate?: { headline?: string; text: string };
  location?: { name: string; lat: number; lng: number };
  isDemo: boolean;
}

/** GET /live/{id}[?since=serverTime] */
export interface LiveFeed {
  coverage: LiveCoverage;
  /** full load: pinned first, then newest first. With `since`: only updates published or edited since then */
  updates: LiveUpdate[];
  /** with `since`: ids of updates deleted since then */
  removedIds: string[];
  /** pass back as `since` on the next poll (server clock — no device-clock skew) */
  serverTime: IsoDate;
  relatedArticles: ArticleSummary[];
}

/** GET /live/archive */
export interface LiveArchivePage { items: LiveCoverage[]; nextCursor: string | null }
/** GET /live */
export interface LiveHub { active: LiveCoverage[]; recent: LiveCoverage[]; archive: LiveArchivePage }

export interface BreakingAlert {
  id: string;
  headline: string;
  articleId?: PublicId;
  url?: string;
  startsAt: IsoDate;
  endsAt: IsoDate | null;
  level: 'breaking' | 'developing' | 'live';
  /** additive field: the alert links to demonstration content — must be labelled "Demo" */
  isDemo?: boolean;
}

export type HomeLayout =
  | 'lead' | 'top_stories' | 'latest' | 'editors_picks' | 'region' | 'investigations'
  | 'opinion' | 'video' | 'podcasts' | 'trending' | 'newsletter' | 'ad';

export interface HomepageSection { key: string; title?: string; layout: HomeLayout; items: ArticleSummary[]; moreUrl?: string }
export interface Homepage {
  generatedAt: IsoDate;
  breaking: BreakingAlert[];
  /** ongoing live coverage for the LIVE UPDATES entry (independent of `breaking`); absent in caches from older versions */
  liveNow?: LiveCoverage[];
  sections: HomepageSection[];
}

/** GET /articles — keyset pagination */
export interface ArticlePage { items: ArticleSummary[]; pageSize: number; nextCursor: string | null }
/** GET /search, GET /authors/{slug}.articles, GET /tags/{slug}.articles */
export interface NumberedPage { items: ArticleSummary[]; page: number; pageSize: number; total: number; nextCursor: string | null }

export interface SyncChanges {
  cursor: string;
  updated: { id: PublicId; revision: number; updatedAt: IsoDate }[];
  withdrawn: Tombstone[];
  hasMore: boolean;
}

export interface PushData { articleId: PublicId; url: string; campaignId: string; revision: number }

export interface AppConfig {
  siteName: string;
  tagline: string;
  minSupportedAppVersion: string;
  adsEnabled: boolean;
  storeUrls: { ios?: string; android?: string; [k: string]: string | undefined };
  social: Record<string, string>;
  contactEmail: string;
  tipsEmail: string;
  /** The publisher's name (Garowe Online Media Group) for the About screen and store notices. */
  publisher?: string;
  pages: { about: string; editorialStandards: string; privacy: string; terms: string };
  /** Website addresses of the same pages, for "Read on goworld.news". */
  pageUrls?: { about: string; editorialStandards: string; privacy: string; terms: string };
}

export interface Ad {
  campaignId: string;
  advertiser: string;
  sponsored: boolean;
  clickUrl: string;
  image: { url: string; width: number; height: number; alt: string } | null;
  headline: string | null;
  text: string | null;
}
export interface AdResponse { placement: string; ad: Ad | null }

export interface NavItem { label: string; href: string; position?: number; children?: NavItem[] }
export interface Category { id: string; slug: string; name: string; parentSlug: string | null; description?: string }

export interface Author { slug: string; name: string; role?: string; bio?: string; avatarUrl?: string; links: Record<string, string>; isDemo: boolean }

export interface PodcastEpisode {
  seriesSlug: string;
  seriesTitle: string;
  articleId: PublicId;
  title: string;
  description?: string;
  publishedAt: IsoDate;
  audioUrl: string;
  audioType?: string;
  durationSeconds?: number;
  episodeNo?: number;
  seasonNo?: number;
}

export interface PushPreferences {
  notificationsEnabled: boolean;
  hasPushToken: boolean;
  breaking: boolean;
  dailyBriefing: boolean;
  categorySlugs: string[];
  quietHours: { start: string; end: string } | null;
}

export interface Bookmark { savedAt: IsoDate; article: Omit<Article, 'body'> & { body?: undefined } }

export interface ResolveResult { kind: 'article' | 'redirect' | 'gone'; canonicalPath: string; status: number; articleId?: PublicId }

export type AnalyticsEventName =
  | 'page_view' | 'article_view' | 'engaged_30s' | 'read_complete' | 'share' | 'push_open'
  | 'video_play' | 'audio_play' | 'newsletter_signup' | 'search';

export interface AnalyticsEvent {
  event: AnalyticsEventName;
  platform: 'web' | 'ios' | 'android';
  articleId?: PublicId;
  sessionId: string;
  path?: string;
  referrer?: string;
  props?: Record<string, string | number | boolean>;
}
