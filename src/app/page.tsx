import Link from 'next/link';
import Image from "next/image";
import { ArrowDownRight, ArrowRight, BarChart3, Check, ClipboardList, Leaf, MessageCircle, ShieldCheck, Sprout } from 'lucide-react';
import { BRELL_EMAIL, BRELL_WHATSAPP, FARM_WHATSAPP } from '@/lib/config';

export default function HomePage() {
  const whatsappUrl = `https://wa.me/${FARM_WHATSAPP}?text=${encodeURIComponent("Habari MESHUKO'S S AND G FARM, ninaomba taarifa zaidi kuhusu shamba lenu.")}`;
  return (
    <main className="public-site">
      <header className="site-header wrap">
        <Link href="/" className="brand-link" aria-label="MESHUKO'S S AND G FARM home"><Image src="/logo.svg"  width={160} height={60} alt="MESHUKO'S S AND G FARM" className="brand-logo" /></Link>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#about">About</a><a href="#records">Our Approach</a><a href="#contact">Contact</a>
        </nav>
        <div className="header-actions"><a className="btn btn-ghost btn-sm" href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={16}/> WhatsApp</a><Link href="/login" className="btn btn-primary btn-sm">Admin sign in <ArrowRight size={16}/></Link></div>
      </header>

      <section className="hero wrap">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot"/> ROOTED IN CARE · BUILT ON GOOD RECORDS</div>
          <h1>Better records.<br/><em>Healthier herds.</em></h1>
          <p className="hero-lead">Thoughtful sheep and goat farming starts with knowing your herd. MESHUKO&apos;S S AND G FARM puts clear livestock records, stock movement and daily reporting at the heart of farm management.</p>
          <div className="hero-actions"><a href={whatsappUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-lg">Talk to our farm <ArrowRight size={18}/></a><a href="#records" className="text-link">Explore our approach <ArrowDownRight size={17}/></a></div>
          <div className="hero-proof"><span><ShieldCheck size={17}/> Clear farm records</span><span><Leaf size={17}/> Sheep &amp; goats</span><span><BarChart3 size={17}/> Stock visibility</span></div>
        </div>
        <div className="hero-visual">
          <div className="hero-image-frame"><Image src="/herd-illustration.svg"  width={160} height={60} alt="Illustration of sheep and goats grazing on a green farm" className="hero-image"/><div className="image-note"><span className="note-icon"><Sprout size={20}/></span><span><strong>Every animal counts.</strong><small>Every movement recorded.</small></span></div></div>
          <div className="floating-stamp"><span>CARE</span><span className="stamp-line"/><span>·</span><span>CONSISTENCY</span></div>
        </div>
        <div className="hero-bottom-rule"/>
      </section>

      <section className="trust-strip wrap" id="about">
        <div><span className="strip-kicker">OUR FARM</span><h2>Care for the herd.<br/>Clarity for every decision.</h2></div>
        <p>Good farm management depends on reliable information. Our record keeping approach is designed to make daily livestock counts easier to follow and past records easier to review.</p>
        <div className="strip-mark"><div className="strip-mark-icon"><Check size={20}/></div><span>Simple by design.<br/><strong>Useful every day.</strong></span></div>
      </section>

      <section className="records-section" id="records">
        <div className="wrap">
          <div className="section-top"><div><span className="section-kicker">A BETTER WAY TO KEEP TRACK</span><h2>From daily notes<br/>to a clearer picture.</h2></div><p>Keep the important numbers organised, consistent and ready when you need them.</p></div>
          <div className="feature-grid">
            <article className="feature-card feature-card-dark"><div className="feature-icon"><ClipboardList size={24}/></div><span className="feature-number">01 / RECORD</span><h3>Daily stock reports</h3><p>Capture the date, animal group and stock changes in one organised report with a printable summary.</p><a href={whatsappUrl} target="_blank" rel="noreferrer" className="feature-arrow" aria-label="Ask about daily records"><ArrowRight size={19}/></a></article>
            <article className="feature-card"><div className="feature-icon feature-icon-gold"><BarChart3 size={24}/></div><span className="feature-number">02 / VISIBILITY</span><h3>Running stock</h3><p>Understand how births, new stock, transfers, losses, mortality, sales and slaughter affect herd quantities.</p><a href={whatsappUrl} target="_blank" rel="noreferrer" className="feature-arrow" aria-label="Ask about stock visibility"><ArrowRight size={19}/></a></article>
            <article className="feature-card"><div className="feature-icon feature-icon-sage"><Sprout size={24}/></div><span className="feature-number">03 / TRACE</span><h3>Movement history</h3><p>Keep internal and external transfer entries together with their dates, quantities and destinations.</p><a href={whatsappUrl} target="_blank" rel="noreferrer" className="feature-arrow" aria-label="Ask about movement history"><ArrowRight size={19}/></a></article>
          </div>
        </div>
      </section>

      <section className="contact-section wrap" id="contact">
        <div className="contact-panel"><div className="contact-copy"><span className="section-kicker section-kicker-light">LET&apos;S TALK FARMING</span><h2>Have a question<br/>about our farm?</h2><p>Reach out on WhatsApp for enquiries and farm information.</p><a className="btn btn-light btn-lg" href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={18}/> Chat on WhatsApp <ArrowRight size={17}/></a></div><div className="contact-art"><Image src="/app-icon.svg"  width={160} height={60} alt="MESHUKO'S S AND G FARM emblem"/><span>Rooted in care.<br/><strong>Growing with purpose.</strong></span></div></div>
      </section>

      <footer className="site-footer wrap">
        <div className="footer-brand"><Image src="/logo.svg" alt="MESHUKO'S S AND G FARM"  width={160} height={60}/><p>Sheep &amp; goat farm records, made clear.</p></div>
        <div className="footer-links"><a href={whatsappUrl} target="_blank" rel="noreferrer">WhatsApp farm</a><Link href="/login">Admin sign in</Link><a href={`mailto:${BRELL_EMAIL}`}>Website support</a></div>
        <div className="footer-meta"><span>© {new Date().getFullYear()} MESHUKO&apos;S S AND G FARM · Farm WhatsApp <a href={whatsappUrl} target="_blank" rel="noreferrer">+255 783 872 819</a></span><span>Website by <strong>Brell</strong> · <a href={`mailto:${BRELL_EMAIL}`}>{BRELL_EMAIL}</a> · <a href={`https://wa.me/${BRELL_WHATSAPP}`} target="_blank" rel="noreferrer">+255 784 452 159</a></span></div>
      </footer>
    </main>
  );
}
