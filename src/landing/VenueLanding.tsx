// /venues: landing where bars, forums and cafés sign up their locations for Live.
import { useEffect } from 'react';
import { ApplyForm, Faq, LandingFooter, LandingNav, Phone, Section, Steps, useShowcaseArtists } from './shared';

export function VenueLanding() {
  const artists = useShowcaseArtists();
  useEffect(() => { document.title = 'gem.fm for venues'; }, []);
  const [a, b, c] = [artists[2] ?? artists[0], artists[3] ?? artists[1], artists[4] ?? artists[0]];
  const img = (x?: { image_url: string }) => (x?.image_url ? { backgroundImage: `url("${x.image_url}")` } : undefined);

  return (
    <div className="lp lp-venues">
      <LandingNav active="venues" />

      <section className="lp-hero">
        <div className="lp-wrap lp-hero-grid">
          <div className="lp-hero-copy">
            <p className="eyebrow">gem.fm for venues</p>
            <h1>Fill your room with people who already love the band.</h1>
            <p className="lp-lede">
              Listeners save emerging artists on gem.fm. When those artists play your stage, we show the night
              to everyone who saved them, and to their friends.
            </p>
            <div className="lp-ctas">
              <a href="#apply" className="btn primary big">List your venue</a>
              <a href="#plans" className="btn big">What’s included</a>
            </div>
            <p className="small muted">Listing is free during the beta</p>
          </div>

          <div className="lp-hero-art">
            <Phone label="gem.fm Live screen with a sponsored night at the top">
              <div className="mock-top">Gigs near you</div>
              <div className="mock-featured">
                <span className="mock-sponsored">Sponsored</span>
                <div className="mock-feat-art" style={img(a)} />
                <b>Your venue</b>
                <span>{a?.name ?? 'Tonight'} · 9:00 PM</span>
                <span className="mock-perk">2x1 drinks with your early-fan stamp</span>
              </div>
              {[b, c].map((x, i) => (
                <div key={i} className="mock-gig">
                  <div className="mock-date" style={img(x)}><b>{i ? 28 : 26}</b></div>
                  <div><b>{x?.name ?? 'Artist'}</b><span>{i ? 'Fri · 10 PM' : 'Wed · 9 PM'}</span></div>
                </div>
              ))}
            </Phone>
            <div className="lp-float lp-float-a" aria-hidden="true">34 fans saved this artist</div>
            <div className="lp-float lp-float-b" aria-hidden="true"><small>CHECKED IN</small><b>+18</b></div>
          </div>
        </div>
      </section>

      <Section eyebrow="Why venues join" title="An audience that already said yes">
        <div className="lp-cards three">
          <article className="lp-card">
            <span className="lp-icon" aria-hidden="true">♥</span>
            <h3>Fans, not just followers</h3>
            <p>Your nights reach listeners who saved the artist on the bill: people who already want to hear them live.</p>
          </article>
          <article className="lp-card">
            <span className="lp-icon" aria-hidden="true">★</span>
            <h3>Featured nights</h3>
            <p>Sponsored nights sit at the top of the Live tab, clearly labelled, for nearby fans of that sound.</p>
          </article>
          <article className="lp-card">
            <span className="lp-icon" aria-hidden="true">✓</span>
            <h3>Proof people came</h3>
            <p>Fans check in at your door to earn early-fan stamps, so you can see who actually showed up.</p>
          </article>
        </div>
      </Section>

      <Section eyebrow="How it works" title="Four steps to a fuller night" tone="raised">
        <Steps steps={[
          { title: 'List your venue', text: 'Tell us where you are, your capacity and the kind of nights you host.' },
          { title: 'Add your gigs', text: 'Every show with an emerging artist appears in Live.' },
          { title: 'We find the fans', text: 'Listeners who saved that artist (and their friends) see the night first.' },
          { title: 'They check in', text: 'Fans prove they were there with an early-fan stamp at your door.' },
        ]} />
      </Section>

      <Section id="plans" eyebrow="Plans" title="Start free. Grow when it works."
        intro="No prices yet: we’re validating with the first venues. Everything paid is always labelled in the app.">
        <div className="lp-plans">
          <article className="lp-plan">
            <h3>Listing</h3>
            <p className="lp-price">Free</p>
            <ul><li>Your venue and gigs in Live</li><li>Check-ins and early-fan stamps</li><li>Shown to fans who saved the artist</li></ul>
          </article>
          <article className="lp-plan featured">
            <span className="lp-badge">Most visible</span>
            <h3>Sponsored nights</h3>
            <p className="lp-price">After beta</p>
            <ul><li>Featured at the top of Live</li><li>Your perk on the card (2x1, free entry…)</li><li>Always labelled “Sponsored”</li></ul>
          </article>
          <article className="lp-plan">
            <h3>Ticketing <span className="lp-soon">Soon</span></h3>
            <p className="lp-price">Commission</p>
            <ul><li>Sell tickets in the app</li><li>To fans who already saved the artist</li><li>Fuller nights with the right audience</li></ul>
          </article>
        </div>
      </Section>

      <Section id="apply" eyebrow="Sign up" title="Put your venue on the map" tone="raised"
        intro="Tell us about your space. We’ll contact you to set up your venue and your first nights in Live.">
        <div className="lp-apply">
          <ApplyForm
            kind="venue"
            submitLabel="Send venue details"
            done={{ title: 'Thanks! Your venue is on our list.', text: 'We’ll get in touch soon to set up your venue and your first nights in Live.' }}
            fields={[
              { name: 'venue', label: 'Venue name', required: true, half: true },
              { name: 'name', label: 'Your name', required: true, half: true, autoComplete: 'name' },
              { name: 'email', label: 'Email', type: 'email', required: true, half: true, autoComplete: 'email' },
              { name: 'phone', label: 'Phone / WhatsApp', type: 'tel', half: true, autoComplete: 'tel' },
              { name: 'area', label: 'Neighbourhood', placeholder: 'Americana, Centro…', half: true },
              { name: 'type', label: 'Type of venue', type: 'select', options: ['Bar', 'Forum / concert hall', 'Café', 'Club', 'Cultural space', 'Other'], half: true },
              { name: 'address', label: 'Address', autoComplete: 'street-address' },
              { name: 'capacity', label: 'Capacity', type: 'select', options: ['Up to 50', '50–150', '150–400', 'More than 400'], half: true },
              { name: 'instagram', label: 'Instagram', placeholder: '@yourvenue', half: true },
              { name: 'goals', label: 'What are you interested in?', type: 'checks', options: ['List our gigs', 'Sponsored nights', 'Ticketing', 'Finding new artists to book'] },
              { name: 'message', label: 'Anything else?', type: 'textarea', placeholder: 'How often you have live music, the genres you book…' },
            ]}
          />
          <Faq items={[
            { q: 'How much does it cost?', a: 'Listing your venue and gigs is free during the beta. Sponsored nights and ticketing will be paid; we’ll agree on prices with the first venues.' },
            { q: 'What does “Sponsored” look like?', a: 'Your night appears at the top of Live with a visible “Sponsored” label and your perk. Listeners always know what’s promoted.' },
            { q: 'Do you only work with emerging artists?', a: 'That’s our focus. Nights with emerging artists are what listeners come to gem.fm for.' },
            { q: 'Where do you operate?', a: 'We start in Guadalajara and the metro area.' },
          ]} />
        </div>
      </Section>

      <LandingFooter />
    </div>
  );
}
