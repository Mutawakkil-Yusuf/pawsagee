// Shared shapes. The demo and Supabase backends both resolve to these.

// Views can hang a teardown function off their root element; the router calls it.
declare global {
  interface HTMLElement {
    _cleanup?: () => void;
  }
  interface Navigator {
    standalone?: boolean;
  }
  interface Window {
    Html5Qrcode?: new (elementId: string, options: Record<string, unknown>) => {
      isScanning: boolean;
      start(...args: unknown[]): Promise<unknown>;
      stop(): Promise<unknown>;
      clear(): Promise<unknown>;
    };
    Html5QrcodeSupportedFormats?: Record<string, string>;
  }
}

export type ShelfColor = 'rose' | 'lilac' | 'mint' | 'butter' | 'sky';
export type ReadingStatus = 'want' | 'reading' | 'finished' | 'paused';

export interface Profile {
  id: string;
  display_name: string | null;
  timezone: string;
  yearly_goal: number;
  daily_goal_pages: number;
  daily_goal_minutes: number;
  reminder_time: string | null;
  onboarded_at: string | null;
  created_at?: string;
}

export interface CatalogBook {
  id: string;
  ol_work_key: string | null;
  ol_cover_id: number | null;
  isbn13: string | null;
  cover_url: string | null;
  title: string;
  authors: string[];
  first_publish_year: number | null;
  page_count: number | null;
  created_by?: string | null;
  created_at?: string;
}

/** A catalog book plus this reader's relationship to it. */
export interface UserBook {
  id: string;
  user_id?: string;
  book_id: string;
  status: ReadingStatus;
  rating: number | null;
  current_page: number;
  started_at: string | null;
  finished_at: string | null;
  is_favorite: boolean;
  notes: string | null;
  /** Per-user overrides so a reader can edit a shared catalog row safely. */
  cover_url?: string | null;
  page_count?: number | null;
  created_at?: string;
  updated_at?: string;
  book: CatalogBook;
  shelf_ids: string[];
  shelf_books?: { shelf_id: string }[];
}

export interface ReadingSession {
  id: string;
  user_id?: string;
  user_book_id: string;
  started_at: string;
  duration_sec: number;
  start_page: number;
  end_page: number;
  pages_read?: number;
  created_at?: string;
}

export interface Shelf {
  id: string;
  user_id?: string;
  name: string;
  color: ShelfColor;
  sort_order: number;
  created_at?: string;
}

export interface SessionUser {
  user: { id: string; email: string | null };
  demo: boolean;
}

export interface StoreState {
  session: SessionUser | null;
  profile: Profile | null;
  shelves: Shelf[];
  books: UserBook[];
  sessions: ReadingSession[];
  online: boolean;
  ready: boolean;
}

/** A book as returned by Open Library / Google Books before it is added. */
export interface BookDoc {
  key?: string | null;
  title: string;
  authors?: string[];
  cover_i?: number | null;
  cover_url?: string | null;
  isbn?: string | null;
  isbn13?: string | null;
  first_publish_year?: number | null;
  page_count?: number | null;
  ia?: string[];
}

export interface LocalBook {
  id: string;
  name: string;
  title: string;
  type: 'pdf' | 'epub' | 'txt';
  size: number;
  addedAt: number;
  lastOpened: number;
  progress: number;   // 0..1
  location: string;   // page number, CFI, or char offset
  blob: Blob;
  cover?: string | null;  // extracted cover as a data URL
}

export interface RouteParams extends Record<string, string> {}
export interface View {
  (params: RouteParams): HTMLElement | Promise<HTMLElement>;
  _cleanup?: () => void;
}
