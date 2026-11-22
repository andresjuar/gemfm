// /artist: landing that offers emerging artists promotion on gem.fm.
import { useEffect } from 'react';
import { ApplyForm, Faq, LandingFooter, LandingNav, Phone, Section, Steps, useShowcaseArtists } from './shared';

export function ArtistLanding() {
  const artists = useShowcaseArtists();
  const hero = artists[0];
  const promoted = artists[1] ?? artists[0];
  useEffect(() => { document.title = 'gem.fm for artists'; }, []);

  return (
    <div className="lp">
      <LandingNav active="artist" />

      <section className="lp-hero">
        <div className="lp-wrap lp-hero-grid">
          <div className="lp-hero-copy">
            <p className="eyebrow">gem.fm for artists</p>
            <h1>Your first fans are already listening.</h1>
            <p className="lp-lede">
              gem.fm puts emerging artists in front of listeners who are actively looking for something new,
              and turns their saves into people at your shows.
            </p>
            <div className="lp-ctas">
              <a href="#apply" className="btn primary big">Get featured</a>
              <a href="#how" className="btn big">How it works</a>
            </div>
            <p className="small muted">Free while we’re in beta · Guadalajara first</p>
          </div>

          <div className="lp-hero-art">
            <Phone label="gem.fm Discover screen with an artist card">
              <div className="mock-top"><span className="mock-dot" /> Daily challenge · 3 / 5</div>
              <div className="mock-card">
                <div className="mock-art" style={hero?.image_url ? { backgroundImage: `url("${hero.image_url}")` } : undefined}>
                  <span className="mock-chip">{hero?.genre?.split(' / ')[0] || 'Indie'} · {hero?.city?.split(',')[0] || 'Guadalajara'}</span>
                  <b>{hero?.name ?? 'Your name here'}</b>
                </div>
                <div className="mock-body">
                  <span className="mock-chip pink">Because you like {hero?.genre?.split(' / ')[0] || 'Indie'}</span>
                  <div className="mock-bar" />
                </div>
              </div>
              <div className="mock-actions"><span>Skip</span><span className="pink">Save</span></div>
            </Phone>
            <div className="lp-float lp-float-a" aria-hidden="true">Saved · +3 pts</div>
            <div className="lp-float lp-float-b" aria-hidden="true"><small>EARLY FAN</small><b>#12</b></div>
          </div>
        </div>
      </section>

      <Section id="how" eyebrow="How it works" title="From a swipe to a sold-out room"
        intro="Listeners pick the styles they like and swipe through emerging artists every day. Here’s what that does for you.">
        <Steps steps={[
          { title: 'Get in the deck', text: 'Listeners who picked your genre hear your song in Discover. No algorithm favouring the already famous: it’s only emerging artists.' },
          { title: 'Saves become an audience', text: 'Every save is someone who asked to hear more from you, not a passive stream.' },
          { title: 'Your gigs reach them', text: 'Your shows appear in the Live tab for everyone who saved you, and their friends.' },
          { title: 'Fans prove they were first', text: 'At the show, fans check in and earn an early-fan stamp that their friends see in the feed.' },
        ]} />
      </Section>

      <Section eyebrow="Promotion" title="Boost what matters. Always labelled." tone="raised"
        intro="Promotion puts you in front of more of the right people. It’s always marked as promoted, so listeners can trust the rest of the app.">
        <div className="lp-split">
          <div className="lp-cards">
            <article className="lp-card">
              <span className="lp-icon" aria-hidden="true">♪</span>
              <h3>Promoted song</h3>
              <p>Extra spots in Discover for listeners whose tastes match your genre.</p>
            </article>
            <article className="lp-card">
              <span className="lp-icon" aria-hidden="true">★</span>
              <h3>Promoted gig</h3>
              <p>Your next show at the top of Live for nearby fans of your sound.</p>
            </article>
            <article className="lp-card">
              <span className="lp-icon" aria-hidden="true">◎</span>
              <h3>Fan insights <span className="lp-soon">Soon</span></h3>
              <p>Who saved you, which neighbourhoods they’re in and who showed up.</p>
            </article>
          </div>
          <div className="lp-promo-mock" aria-hidden="true">
            <div className="lp-promo-card">
              <div className="lp-promo-art" style={promoted?.image_url ? { backgroundImage: `url("${promoted.image_url}")` } : undefined}>
                <span className="lp-promoted">Promoted</span>
              </div>
              <div className="lp-promo-body">
                <b>{promoted?.name ?? 'Your project'}</b>
                <span>{promoted?.genre || 'Alternative'} · new single</span>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section eyebrow="Why gem.fm" title="Built for the artists streaming forgets">
        <div className="lp-compare">
          <div><h3>Streaming apps</h3><p>Mostly passive; recommendations lean toward familiar, popular artists.</p></div>
          <div><h3>Social media</h3><p>Music is found by chance and depends on going viral.</p></div>
          <div className="ours"><h3>gem.fm</h3><p>Active discovery of emerging artists only, from the first listen to the front row.</p></div>
        </div>
      </Section>

      <Section id="apply" eyebrow="Apply" title="Get featured on gem.fm" tone="raised"
        intro="Tell us about your music. We’ll get back to you to set up your profile and your first songs in Discover.">
        <div className="lp-apply">
          <ApplyForm
            kind="artist"
            submitLabel="Send application"
            done={{ title: 'Thanks! We got your application.', text: 'We’ll listen to your music and write to you soon to set up your profile.' }}
            fields={[
              { name: 'project', label: 'Artist or band name', required: true, half: true },
              { name: 'name', label: 'Your name', required: true, half: true, autoComplete: 'name' },
              { name: 'email', label: 'Email', type: 'email', required: true, half: true, autoComplete: 'email' },
              { name: 'instagram', label: 'Instagram', placeholder: '@yourband', half: true },
              { name: 'genre', label: 'Genre', placeholder: 'Indie rock, cumbia…', half: true },
              { name: 'city', label: 'City', placeholder: 'Guadalajara', half: true },
              { name: 'spotify', label: 'Spotify link', type: 'url', placeholder: 'https://open.spotify.com/artist/…' },
              { name: 'goals', label: 'What are you interested in?', type: 'checks', options: ['Get into Discover', 'Promote a song', 'Promote a gig', 'Fan insights'] },
              { name: 'message', label: 'Anything else?', type: 'textarea', placeholder: 'Upcoming release, next gigs, what makes your music yours…' },
            ]}
          />
          <Faq items={[
            { q: 'Does it cost anything?', a: 'Being in Discover is free while we’re in beta. Promotion will be paid and always labelled as promoted.' },
            { q: 'Who can apply?', a: 'Emerging and independent artists. If you already fill arenas, you don’t need us.' },
            { q: 'Do I have to be from Guadalajara?', a: 'No. Anyone can be in Discover. Live shows and venues start in Guadalajara.' },
            { q: 'What do I need?', a: 'At least one song on Spotify or Deezer. Gigs are optional but help a lot.' },
          ]} />
        </div>
      </Section>

      <LandingFooter />
    </div>
  );
}
