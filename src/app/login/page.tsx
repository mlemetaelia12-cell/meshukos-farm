import Link from 'next/link';
import Image from "next/image";
import { ArrowLeft, LockKeyhole, ShieldCheck } from 'lucide-react';
import LoginForm from '@/components/LoginForm';

export const metadata = { title: 'Admin sign in' };
export default function LoginPage() {
  return <main className="login-shell">
    <div className="login-image-side"><Link href="/" className="login-back"><ArrowLeft size={17}/> Back to farm website</Link><div className="login-image-content"><span className="section-kicker section-kicker-light">PRIVATE FARM WORKSPACE</span><h1>Care for every<br/><em>count.</em></h1><p>One secure place for daily reports, stock movements and farm history.</p><div className="login-benefit"><ShieldCheck size={18}/><span>Only authorised farm admin access</span></div></div><div className="login-image-credit">MESHUKO&apos;S S AND G FARM · SHEEP &amp; GOAT RECORDS</div></div>
    <section className="login-form-side"><div className="login-form-wrap"><Link href="/" className="login-brand"><Image src="/logo.svg" alt="MESHUKO&apos;S S AND G FARM"  width={160} height={60}/></Link><div className="login-heading"><span className="login-lock"><LockKeyhole size={21}/></span><span className="section-kicker">OWNER ACCESS</span><h2>Welcome back.</h2><p>Sign in to open your farm dashboard.</p></div><LoginForm/><div className="login-secure-note"><ShieldCheck size={16}/><span>Your login is private. No public account registration is available.</span></div><div className="login-form-footer">Need help? <a href="mailto:buildwebtz@gmail.com">Contact Brell website support</a></div></div></section>
  </main>;
}
