// Shapes shared by the API (server/) and the React app (src/).

export interface User {
  id: number;
  name: string;
  handle: string;
  color: string;
  /** Slugs of the taste tags the user picked. */
  tags: string[];
}

export interface Tag {
  slug: string;
  label: string;
  /** How many approved artists carry this tag. */
  artists: number;
}

export interface Badge {
  id: string;
  name: string;
  earned: boolean;
  hint: string;
}

export interface Stats {
  swipes: number;
  saves: number;
  checkins: number;
  recs: number;
  challenges: number;
  following: number;
  followers: number;
  points: number;
  badges: Badge[];
}

export interface Me extends User {
  stats: Stats;
  today: number;
  goal: number;
}

export type ArtistStatus = 'approved' | 'pending' | 'rejected';
export type ArtistSource = 'manual' | 'import' | 'radar';

export interface Artist {
  id: number;
  name: string;
  genre: string;
  city: string;
  bio: string;
  spotify_url: string;
  image_url: string;
  deezer_id: number | null;
  external_fans: number | null;
  source: ArtistSource;
  status: ArtistStatus;
  color: string;
  /** Language they sing in ("Spanish", "English"…), detected automatically. */
  language: string;
  /** Taste tags, derived from genre by the database. */
  tags: string[];
  created_at: string;
  saves: number;
}

export interface DiscoverArtist extends Artist {
  next_gig: string | null;
  /** Labels of the user's tastes this artist matches. */
  matched: string[];
}

export interface DiscoverResponse {
  artists: DiscoverArtist[];
  today: number;
  goal: number;
  bonus: boolean;
}

export interface SwipeResponse {
  today: number;
  goal: number;
  completed: boolean;
  stats: Stats;
}

export interface Gig {
  id: number;
  artist_id: number;
  venue_id: number;
  starts_at: string;
  price_mxn: number;
  artist: string;
  genre: string;
  color: string;
  image_url: string;
  spotify_url: string;
  venue: string;
  area: string;
  saved: boolean;
  checked_in: boolean;
  attendees: number;
  friends_there: string | null;
}

export interface Stamp {
  created_at: string;
  artist: string;
  color: string;
  venue: string;
  fan_number: number;
}

export interface Profile extends User {
  stats: Stats;
  stamps: Stamp[];
  saved: Artist[];
  isFollowing: boolean;
}

export interface Person extends User {
  following: boolean;
}

export interface PostComment {
  id: number;
  body: string;
  created_at: string;
  user_id: number;
  user: string;
  handle: string;
}

export interface FeedItem {
  /** 'rec:<id>', 'save:<user>:<artist>' or 'checkin:<user>:<gig>' */
  key: string;
  type: 'rec' | 'save' | 'checkin';
  at: string;
  user_id: number;
  user: string;
  handle: string;
  user_color: string;
  artist_id: number;
  artist: string;
  genre: string;
  city: string;
  color: string;
  image_url: string;
  spotify_url: string;
  deezer_id: number | null;
  note: string | null;
  venue: string | null;
  likes: number;
  liked: boolean;
  comment_count: number;
  /** The latest two comments, oldest first. */
  comments: PostComment[];
  /** Posted by you or someone you follow. */
  following: boolean;
  /** You saved this artist. */
  saved: boolean;
}

export interface SuggestedPerson extends Person {
  posts: number;
  mutual: number;
}

export interface Venue {
  id: number;
  name: string;
  area: string;
}

export interface Preview {
  title: string;
  preview: string;
  link: string;
}

export interface RadarResult {
  seeds: string[];
  scanned: number;
  added: Artist[];
}
