// Friends feed, Instagram-style: tall posts with the artist's photo, likes,
// comments, saving the artist and following people right from the feed.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { FeedItem, Person, PostComment, Profile, SuggestedPerson } from '../../shared/types';
import type { AppActions } from '../App';
import { api } from '../api';
import { ArtistImage } from '../components/ArtistImage';
import { Avatar } from '../components/Avatar';
import { Player } from '../components/Player';
import { getLang, t as tr, useT } from '../i18n';
import { ago, initial, plural } from '../lib/format';
import { useLoad } from '../lib/useLoad';
import { SheetCloseButton, useUi } from '../ui';

export function Friends(props: AppActions) {
  const t = useT();
  const { me, refreshMe } = props;
  const { toast, openSheet } = useUi();
  const [posts, setPosts] = useState<FeedItem[] | null>(null);
  const [people, setPeople] = useState<SuggestedPerson[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [feed, suggested] = await Promise.all([api<FeedItem[]>('/feed'), api<SuggestedPerson[]>('/people/suggested')]);
      setPosts(feed);
      setPeople(suggested);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  useEffect(() => { load(); }, []);

  const patchPosts = (match: (p: FeedItem) => boolean, change: Partial<FeedItem>) =>
    setPosts((list) => list?.map((p) => (match(p) ? { ...p, ...change } : p)) ?? null);

  const follow = async (userId: number, on: boolean) => {
    try {
      await api('/follows/' + userId, on ? 'POST' : 'DELETE');
      patchPosts((p) => p.user_id === userId, { following: on });
      setPeople((list) => list.map((p) => (p.id === userId ? { ...p, following: on } : p)));
      await refreshMe();
    } catch (err) {
      toast((err as Error).message);
    }
  };

  const saveArtist = async (post: FeedItem) => {
    try {
      await api('/swipes', 'POST', { artistId: post.artist_id, liked: !post.saved });
      patchPosts((p) => p.artist_id === post.artist_id, { saved: !post.saved });
      await refreshMe();
      toast(post.saved ? t('Removed {name} from your saves', { name: post.artist }) : t('Saved {name} · +3 pts', { name: post.artist }));
    } catch (err) {
      toast((err as Error).message);
    }
  };

  if (error) return <div className="panel empty">{error}</div>;
  if (!posts) return <div className="panel empty" aria-busy="true">{t('Loading your feed…')}</div>;

  const mine = posts.filter((p) => p.following);
  const more = posts.filter((p) => !p.following);
  const postProps = { ...props, follow, saveArtist, onChange: patchPosts };

  return (
    <>
      <div className="row between feed-pad">
        <h2>{t('Friends')}</h2>
        <div className="row">
          <button className="btn small" onClick={() => openSheet(<ShareSheet me={me} onShared={load} />)}>{t('Share')}</button>
          <button className="btn small" onClick={() => openSheet(<FindPeople onChange={load} />)}>{t('Find people')}</button>
        </div>
      </div>

      {people.length > 0 && <Suggestions people={people} follow={follow} showProfile={props.showProfile} />}

      {mine.length === 0 && (
        <div className="panel empty feed-pad">
          <p className="m0"><b>{t('Your feed is empty.')}</b></p>
          <p className="small m0">{t('Follow people above or from the posts below to see what they discover.')}</p>
        </div>
      )}
      {mine.map((p) => <Post key={p.key} post={p} {...postProps} />)}

      {more.length > 0 && (
        <>
          <div className="feed-divider feed-pad"><span className="eyebrow">{t('Suggested posts')}</span></div>
          {more.map((p) => <Post key={p.key} post={p} {...postProps} />)}
        </>
      )}
      {mine.length > 0 && more.length === 0 && <p className="small muted center">{t('You’re all caught up.')}</p>}
    </>
  );
}

// ---------- Suggested people strip ----------
function Suggestions({ people, follow, showProfile }: {
  people: SuggestedPerson[];
  follow: (id: number, on: boolean) => void;
  showProfile: (id: number) => void;
}) {
  const t = useT();
  return (
    <section aria-label={t('People to follow')}>
      <div className="row between feed-pad"><span className="eyebrow">{t('Suggested for you')}</span></div>
      <div className="people-strip">
        {people.map((p) => (
          <div key={p.id} className="person-card">
            <button className="linkish person-card-top" onClick={() => showProfile(p.id)}>
              <Avatar name={p.name} color={p.color} size={56} />
              <b className="small">{p.name}</b>
              <span className="small muted">@{p.handle}</span>
            </button>
            <span className="tiny muted">
              {p.mutual ? plural(p.mutual, '{n} friend in common', '{n} friends in common') : p.posts ? plural(p.posts, '{n} post', '{n} posts') : t('New here')}
            </span>
            <button className={`btn small ${p.following ? '' : 'primary'}`} onClick={() => follow(p.id, !p.following)}>
              {p.following ? t('Following') : t('Follow')}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- One post ----------
type PostProps = AppActions & {
  post: FeedItem;
  follow: (id: number, on: boolean) => void;
  saveArtist: (post: FeedItem) => void;
  onChange: (match: (p: FeedItem) => boolean, change: Partial<FeedItem>) => void;
};

const VERB = { rec: 'recommends', save: 'saved', checkin: 'got an early-fan stamp for' } as const;
const BADGE = { rec: 'Recommendation', save: 'Saved', checkin: 'Early fan' } as const;
// When the post is yours the verb changes: "You recommend" / "Tú recomiendas".
const VERB_ME = {
  en: { rec: 'recommend', save: 'saved', checkin: 'got an early-fan stamp for' },
  es: { rec: 'recomiendas a', save: 'guardaste a', checkin: 'obtuviste un sello de early fan de' },
} as const;
const verb = (type: keyof typeof VERB, isMe: boolean) => (isMe ? VERB_ME[getLang()][type] : tr(VERB[type]));

function Post({ post: p, me, follow, saveArtist, onChange, showProfile }: PostProps) {
  const t = useT();
  const { toast } = useUi();
  const [showPlayer, setShowPlayer] = useState(false);
  const [allComments, setAllComments] = useState<PostComment[] | null>(null);
  const [comment, setComment] = useState('');
  const [burst, setBurst] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const isMe = p.user_id === me.id;

  const toggleLike = async (force?: boolean) => {
    const on = force ?? !p.liked;
    if (on === p.liked) return;
    onChange((x) => x.key === p.key, { liked: on, likes: p.likes + (on ? 1 : -1) });
    try {
      const r = await api<{ liked: boolean; likes: number }>(`/posts/${p.key}/like`, on ? 'POST' : 'DELETE');
      onChange((x) => x.key === p.key, r);
    } catch (err) {
      onChange((x) => x.key === p.key, { liked: p.liked, likes: p.likes });
      toast((err as Error).message);
    }
  };

  const doubleTap = () => {
    setBurst(true);
    window.setTimeout(() => setBurst(false), 700);
    toggleLike(true);
  };

  const viewAll = async () => {
    try {
      setAllComments(await api<PostComment[]>(`/posts/${p.key}/comments`));
    } catch (err) {
      toast((err as Error).message);
    }
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = comment.trim();
    if (!body) return;
    try {
      const c = await api<PostComment>(`/posts/${p.key}/comments`, 'POST', { body });
      setComment('');
      if (allComments) setAllComments([...allComments, c]);
      onChange((x) => x.key === p.key, { comments: [...p.comments, c].slice(-2), comment_count: p.comment_count + 1 });
    } catch (err) {
      toast((err as Error).message);
    }
  };

  const comments = allComments ?? p.comments;
  const media = p.image_url
    ? { backgroundImage: `url("${p.image_url}")` }
    : { background: `linear-gradient(150deg, ${p.color}, #120E1A 140%)` };

  return (
    <article className="post" aria-label={`${isMe ? t('You') : p.user} ${verb(p.type, isMe)} ${p.artist}`}>
      <header className="post-head">
        <button className="linkish row" onClick={() => showProfile(p.user_id)}>
          <span className="ring"><Avatar name={p.user} color={p.user_color} size={34} /></span>
          <span className="post-who">
            <b>{isMe ? t('You') : p.user}</b>
            <span className="tiny muted">@{p.handle} · {ago(p.at)}</span>
          </span>
        </button>
        {!isMe && !p.following && (
          <button className="btn small primary" onClick={() => follow(p.user_id, true)}>{t('Follow')}</button>
        )}
      </header>

      <div className={`post-media ${p.image_url ? 'photo' : ''}`} style={media} onDoubleClick={doubleTap}>
        {!p.image_url && <span className="post-initial" aria-hidden="true">{initial(p.artist)}</span>}
        <span className={`post-badge ${p.type}`}>{t(BADGE[p.type])}{p.type === 'checkin' && p.venue ? ` · ${p.venue}` : ''}</span>
        <div className="post-media-text">
          <h3>{p.artist}</h3>
          {(p.genre || p.city) && <span className="small">{[p.genre && t(p.genre), p.city].filter(Boolean).join(' · ')}</span>}
        </div>
        {burst && <span className="heart-burst" aria-hidden="true"><HeartIcon filled size={96} /></span>}
      </div>

      <div className="post-actions">
        <button className={`icon-btn ${p.liked ? 'liked' : ''}`} aria-pressed={p.liked} aria-label={p.liked ? t('Unlike') : t('Like')} onClick={() => toggleLike()}>
          <HeartIcon filled={p.liked} />
        </button>
        <button className="icon-btn" aria-label={t('Comment')} onClick={() => input.current?.focus()}><CommentIcon /></button>
        <button className={`icon-btn ${showPlayer ? 'on' : ''}`} aria-pressed={showPlayer} aria-label={showPlayer ? t('Hide player') : t('Listen')}
          onClick={() => setShowPlayer((s) => !s)}><PlayIcon /></button>
        <span className="grow" />
        <button className={`icon-btn ${p.saved ? 'saved' : ''}`} aria-pressed={p.saved}
          aria-label={p.saved ? t('Remove {name} from your saves', { name: p.artist }) : t('Save {name}', { name: p.artist })} onClick={() => saveArtist(p)}>
          <BookmarkIcon filled={p.saved} />
        </button>
      </div>

      {showPlayer && <div className="post-player"><Player artistId={p.artist_id} spotifyUrl={p.spotify_url} deezerId={p.deezer_id} autoPlay /></div>}

      <div className="post-body">
        {p.likes > 0 && <b className="small">{plural(p.likes, '{n} like', '{n} likes')}</b>}
        <p className="m0 small">
          <b>{isMe ? t('You') : p.user}</b> {verb(p.type, isMe)} <b>{p.artist}</b>{p.type === 'checkin' && p.venue ? t(' at {venue}', { venue: p.venue }) : ''}
          {p.note ? <> — {p.note}</> : null}
        </p>
        {p.comment_count > comments.length && (
          <button className="linkish small muted" onClick={viewAll}>{t('View all {n} comments', { n: p.comment_count })}</button>
        )}
        {comments.map((c) => (
          <p key={c.id} className="m0 small"><b>{c.user_id === me.id ? t('You') : c.handle}</b> {c.body}</p>
        ))}
        <form className="comment-form" onSubmit={send}>
          <Avatar name={me.name} color={me.color} size={26} />
          <input ref={input} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={300}
            placeholder={t('Add a comment…')} aria-label={t('Comment on {name}’s post', { name: p.user })} />
          {comment.trim() && <button className="linkish accent small">{t('Post')}</button>}
        </form>
      </div>
    </article>
  );
}

// ---------- Sheets ----------
function ShareSheet({ me, onShared }: { me: AppActions['me']; onShared: () => void }) {
  const t = useT();
  const { toast, closeSheet } = useUi();
  const { data: profile } = useLoad(() => api<Profile>('/users/' + me.id), [me.id]);
  const [artistId, setArtistId] = useState('');
  const [note, setNote] = useState('');

  const share = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api('/recommendations', 'POST', { artistId: Number(artistId || profile?.saved[0]?.id), note });
      closeSheet();
      toast(t('Shared with your friends · +5 pts'));
      onShared();
    } catch (err) {
      toast((err as Error).message);
    }
  };

  return (
    <form className="stack" onSubmit={share}>
      <h2>{t('Share a recommendation')}</h2>
      {!profile && <p className="muted small" aria-busy="true">{t('Loading your saved artists…')}</p>}
      {profile && !profile.saved.length && <p className="muted small m0">{t('Save an artist in Discover (or from a post) to recommend them.')}</p>}
      {profile && profile.saved.length > 0 && (
        <>
          <div className="share-pick">
            {profile.saved.map((a) => {
              const on = String(a.id) === (artistId || String(profile.saved[0].id));
              return (
                <button type="button" key={a.id} className={`share-artist ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setArtistId(String(a.id))}>
                  <ArtistImage artist={a} size={64} />
                  <span className="tiny">{a.name}</span>
                </button>
              );
            })}
          </div>
          <input maxLength={200} placeholder={t('Why should your friends listen?')} aria-label={t('Note')} value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn primary">{t('Share')}</button>
        </>
      )}
      <SheetCloseButton>{t('Cancel')}</SheetCloseButton>
    </form>
  );
}

function FindPeople({ onChange }: { onChange: () => void }) {
  const t = useT();
  const [q, setQ] = useState('');
  const { data: people, reload } = useLoad(() => api<Person[]>('/people?q=' + encodeURIComponent(q)), [q]);

  const toggle = async (p: Person) => {
    await api('/follows/' + p.id, p.following ? 'DELETE' : 'POST');
    await reload();
    onChange();
  };

  return (
    <>
      <h2>{t('Find people')}</h2>
      <input placeholder={t('Search by name or @username')} aria-label={t('Search people')} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div className="stack">
        {people?.length === 0 && <p className="muted">{t('No one matches that name.')}</p>}
        {people?.map((p) => (
          <div key={p.id} className="person">
            <span className="row">
              <Avatar name={p.name} color={p.color} />
              <span>{p.name}<br /><span className="small muted">@{p.handle}</span></span>
            </span>
            <button className={`btn small ${p.following ? '' : 'primary'}`} onClick={() => toggle(p)}>
              {p.following ? t('Following') : t('Follow')}
            </button>
          </div>
        ))}
      </div>
      <SheetCloseButton />
    </>
  );
}

// ---------- Icons ----------
function HeartIcon({ filled = false, size = 26 }: { filled?: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"
        fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
    </svg>
  );
}
const CommentIcon = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <path d="M20.5 11.5a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l1.4-4.4A8.5 8.5 0 1 1 20.5 11.5z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
  </svg>
);
const PlayIcon = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.9" />
    <path d="M10 8.5v7l6-3.5z" fill="currentColor" />
  </svg>
);
function BookmarkIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path d="M6 3.5h12v17l-6-4.3-6 4.3z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
    </svg>
  );
}
