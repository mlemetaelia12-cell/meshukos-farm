'use client';

import Link from 'next/link';
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity, ArrowLeftRight, ArrowRight, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Download, FileText,
  LayoutDashboard, Leaf, LogOut, Menu, Plus, Search, Settings2, ShieldCheck, Sprout, TrendingDown, TrendingUp, Warehouse,
  X, PawPrint, RefreshCw
} from 'lucide-react';

type View = 'overview' | 'livestock' | 'reports' | 'transfers' | 'history' | 'settings';
type Group = {
  id: string; type: 'SHEEP' | 'GOAT'; breed: string; sex: string; category: string; group_name: string;
  tip_tag: string; tag_colour: string; live_stock: string | number; active?: boolean;
};
type Report = { id: string; report_date: string; status: 'DRAFT' | 'FINALIZED' | 'VOIDED'; created_at: string; finalized_at?: string | null };
type Movement = { id: string; movement_type: string; quantity: string | number; effective_date: string; external_party?: string | null; notes?: string | null; type: string; breed: string; sex: string; category: string; group_name: string; created_at?: string };
type DashboardData = { stats: { total_stock: string | number; sheep_count: string | number; goat_count: string | number; sick_count: string | number; reports_count: number; group_count: number }; groups: Group[]; recentReports: Report[]; recentMovements: Movement[]; today: string };

const navItems: { key: View; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'livestock', label: 'Livestock groups', icon: Warehouse },
  { key: 'reports', label: 'Daily reports', icon: FileText },
  { key: 'transfers', label: 'Stock transfers', icon: ArrowLeftRight },
  { key: 'history', label: 'Movement history', icon: Activity },
  { key: 'settings', label: 'Farm settings', icon: Settings2 }
];
const movementLabels: Record<string, string> = {
  OPENING: 'Opening balance', BIRTH: 'Newborn', NEW_STOCK: 'New stock', TRANSFER_IN: 'Transfer in',
  TRANSFER_OUT: 'Transfer out', LOST: 'Lost', MORTALITY: 'Mortality', SOLD: 'Sold', SLAUGHTER: 'Slaughter',
  ADJUSTMENT_IN: 'Stock adjustment +', ADJUSTMENT_OUT: 'Stock adjustment −'
};
const fmt = (value: string | number | undefined | null) => Number(value || 0).toLocaleString('en-US');
const dateLabel = (date: string) => date ? new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

async function requestJson<T = { error?: string }>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }, cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const message = (data as { error?: unknown }).error; throw new Error(typeof message === 'string' ? message : 'Request failed. Please try again.'); }
  return data as T;
}

export default function DashboardClient() {
  const router = useRouter();
  const [view, setView] = useState<View>('overview');
  const [data, setData] = useState<DashboardData | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [transfers, setTransfers] = useState<Movement[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupForm, setGroupForm] = useState({ type: 'SHEEP', breed: '', sex: 'FEMALE', category: 'EWES', groupName: 'MAIN HERD', tipTag: '', tagColour: '', openingQuantity: '0', openingDate: '' });
  const [reportDate, setReportDate] = useState('');
  const [transferForm, setTransferForm] = useState({ mode: 'INTERNAL', sourceGroupId: '', destinationGroupId: '', quantity: '1', effectiveDate: '', externalParty: '', notes: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, reps] = await Promise.all([
        requestJson<DashboardData>('/api/dashboard'),
        requestJson<{ reports: Report[]; today: string }>('/api/reports')
      ]);
      setData(dash); setReports(reps.reports); setReportDate((current) => current || dash.today);
      setGroupForm((current) => ({ ...current, openingDate: current.openingDate || dash.today }));
      setTransferForm((current) => ({
        ...current,
        effectiveDate: current.effectiveDate || dash.today,
        sourceGroupId: current.sourceGroupId || dash.groups[0]?.id || '',
        destinationGroupId: current.destinationGroupId || dash.groups.find((g) => g.id !== dash.groups[0]?.id && g.type === dash.groups[0]?.type)?.id || ''
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Imeshindikana kupakia dashboard.';
      if (message.toLowerCase().includes('ingia kwanza')) router.replace('/login');
      setToast({ type: 'error', text: message });
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { void loadData(); }, [loadData]);
  useEffect(() => {
    if (toast) { const timer = window.setTimeout(() => setToast(null), 4600); return () => window.clearTimeout(timer); }
  }, [toast]);

  const switchView = async (next: View) => {
    setView(next); setMobileNav(false);
    try {
      if (next === 'transfers') {
        const result = await requestJson<{ transfers: Movement[] }>('/api/transfers'); setTransfers(result.transfers);
      } else if (next === 'history') {
        const result = await requestJson<{ movements: Movement[] }>('/api/movements'); setMovements(result.movements);
      } else if (next === 'reports') {
        const result = await requestJson<{ reports: Report[] }>('/api/reports'); setReports(result.reports);
      }
    } catch (error) { setToast({ type: 'error', text: error instanceof Error ? error.message : 'Imeshindikana kupakia taarifa.' }); }
  };

  async function submitGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try {
      await requestJson('/api/groups', { method: 'POST', body: JSON.stringify({ ...groupForm, openingQuantity: Number(groupForm.openingQuantity) }) });
      setToast({ type: 'success', text: 'Livestock group added successfully.' }); setShowGroupForm(false);
      setGroupForm((current) => ({ ...current, breed: '', openingQuantity: '0', tipTag: '', tagColour: '' })); await loadData();
    } catch (error) { setToast({ type: 'error', text: error instanceof Error ? error.message : 'Imeshindikana kuhifadhi kundi.' }); }
    finally { setBusy(false); }
  }

  async function startReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try {
      const result = await requestJson<{ report: Report }>('/api/reports', { method: 'POST', body: JSON.stringify({ reportDate }) });
      router.push(`/dashboard/reports/${result.report.id}`);
    } catch (error) { setToast({ type: 'error', text: error instanceof Error ? error.message : 'Imeshindikana kuanza ripoti.' }); }
    finally { setBusy(false); }
  }

  async function submitTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try {
      await requestJson('/api/transfers', { method: 'POST', body: JSON.stringify({ ...transferForm, quantity: Number(transferForm.quantity), sourceGroupId: transferForm.mode === 'EXTERNAL_IN' ? null : transferForm.sourceGroupId || null, destinationGroupId: transferForm.mode === 'EXTERNAL_OUT' ? null : transferForm.destinationGroupId || null }) });
      setToast({ type: 'success', text: 'Stock transfer recorded.' }); setTransferForm((current) => ({ ...current, quantity: '1', externalParty: '', notes: '' }));
      const result = await requestJson<{ transfers: Movement[] }>('/api/transfers'); setTransfers(result.transfers); await loadData();
    } catch (error) { setToast({ type: 'error', text: error instanceof Error ? error.message : 'Imeshindikana kurekodi transfer.' }); }
    finally { setBusy(false); }
  }

  async function logout() {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } finally { router.replace('/'); router.refresh(); }
  }

  const filteredGroups = useMemo(() => (data?.groups || []).filter((g) => `${g.type} ${g.breed} ${g.sex} ${g.category} ${g.group_name} ${g.tip_tag}`.toLowerCase().includes(searchTerm.toLowerCase())), [data?.groups, searchTerm]);
  const activeTitle = navItems.find((item) => item.key === view)?.label || 'Overview';
  const groups = data?.groups || [];

  return <main className="admin-app">
    <aside className={`admin-sidebar ${mobileNav ? 'is-open' : ''}`}>
      <Link href="/" className="admin-brand"><Image src="/logo.svg" alt="MESHUKO'S S AND G FARM"  width={160} height={60}/><span className="admin-brand-label">FARM OPERATIONS <i>MANAGEMENT PORTAL</i></span></Link>
      <div className="sidebar-section-label">WORKSPACE</div>
      <nav className="sidebar-nav" aria-label="Dashboard navigation">{navItems.map((item) => { const Icon = item.icon; return <button key={item.key} onClick={() => void switchView(item.key)} className={`sidebar-nav-item ${view === item.key ? 'active' : ''}`}><Icon size={18}/><span>{item.label}</span>{item.key === 'reports' && reports.some((r) => r.status === 'DRAFT') && <span className="nav-count">{reports.filter((r) => r.status === 'DRAFT').length}</span>}</button>; })}</nav>
      <div className="sidebar-bottom"><div className="sidebar-help"><div className="help-icon"><CircleHelp size={18}/></div><strong>Need help?</strong><p>Get assistance with your farm records.</p><a href="mailto:buildwebtz@gmail.com">Contact Brell <ArrowRight size={14}/></a></div><button className="sidebar-logout" onClick={logout}><LogOut size={18}/> Sign out</button><div className="sidebar-branding">POWERED BY <strong>BRELL</strong></div></div>
    </aside>

    {mobileNav && <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNav(false)}/>}
    <section className="admin-main">
      <header className="admin-topbar"><div className="topbar-leading"><button className="mobile-menu-button icon-button" onClick={() => setMobileNav((v) => !v)} aria-label="Open navigation"><Menu size={21}/></button><div><div className="breadcrumb"><span>Farm workspace</span><ChevronRight size={14}/><strong>{activeTitle}</strong></div><p className="topbar-date"><CalendarDays size={14}/>{dateLabel(data?.today || '')}</p></div></div><div className="topbar-trailing"><span className="secure-pill"><span/> System secure</span><button className="icon-button refresh-button" onClick={() => void loadData()} aria-label="Refresh dashboard"><RefreshCw size={17}/></button><div className="profile-mini"><div className="profile-avatar">O</div><span><strong>Farm Owner</strong><small>Owner / Admin</small></span><ChevronDown size={15}/></div></div></header>
      <div className="admin-content">
        {toast && <div className={`toast toast-${toast.type}`} role="status"><span>{toast.type === 'success' ? <CheckCircle2 size={18}/> : <CircleHelp size={18}/>}</span><p>{toast.text}</p><button onClick={() => setToast(null)} aria-label="Dismiss"><X size={16}/></button></div>}
        {loading && !data ? <div className="loading-state"><span className="loader-ring"/><strong>Preparing your farm workspace…</strong><p>Connecting to your live farm records.</p></div> : <>
          {view === 'overview' && <>
            <div className="page-heading-row"><div><div className="page-kicker"><Sprout size={15}/> FARM AT A GLANCE</div><h1>Good day, Meshuko<span className="heading-period">.</span></h1><p>Here&apos;s the latest picture of your sheep and goat stock.</p></div><button onClick={() => void switchView('reports')} className="btn btn-primary"><Plus size={17}/> New daily report</button></div>
            <div className="overview-banner"><div className="banner-content"><span className="banner-eyebrow">MESHUKO&apos;S S AND G FARM</span><h2>Know your herd.<br/><em>Stay in control.</em></h2><p>Daily records and stock movements, in one clear workspace.</p><button onClick={() => void switchView('livestock')} className="banner-link">View livestock groups <ArrowRight size={16}/></button></div><div className="banner-image"><Image src="/herd-illustration.svg" alt="Sheep and goats in a pasture"  width={160} height={60}/></div><div className="banner-leaf"><Leaf size={40}/></div></div>
            <div className="stats-grid">
              <StatCard label="Total live stock" value={fmt(data?.stats.total_stock)} icon={<Warehouse size={19}/>} note="Across active groups" accent="green"/>
              <StatCard label="Sheep" value={fmt(data?.stats.sheep_count)} icon={<PawPrint size={19}/>} note={`${groups.filter((g) => g.type === 'SHEEP').length} active groups`} accent="sand"/>
              <StatCard label="Goats" value={fmt(data?.stats.goat_count)} icon={<PawPrint size={19}/>} note={`${groups.filter((g) => g.type === 'GOAT').length} active groups`} accent="blue"/>
              <StatCard label="Sick animals" value={fmt(data?.stats.sick_count)} icon={<Activity size={19}/>} note="Latest finalized reports" accent="rose"/>
            </div>
            <div className="overview-lower-grid"><section className="panel overview-panel"><div className="panel-heading"><div><h3>Livestock groups</h3><p>Current stock by category and group.</p></div><button onClick={() => void switchView('livestock')} className="link-button">View all <ArrowRight size={15}/></button></div>{groups.length ? <div className="group-preview-list">{groups.slice(0, 5).map((group) => <GroupRow key={group.id} group={group}/>)}</div> : <EmptyState icon={<Warehouse size={22}/>} title="No livestock groups yet" message="Add the first group and its opening stock to begin." action={<button className="btn btn-primary btn-sm" onClick={() => { setView('livestock'); setShowGroupForm(true); }}>Add first group</button>}/>}</section>
              <section className="panel overview-panel"><div className="panel-heading"><div><h3>Report activity</h3><p>Your most recent daily reports.</p></div><button onClick={() => void switchView('reports')} className="link-button">Report history <ArrowRight size={15}/></button></div>{reports.length ? <div className="report-preview-list">{reports.slice(0, 5).map((report) => <Link href={`/dashboard/reports/${report.id}`} className="report-preview-row" key={report.id}><span className="report-preview-icon"><FileText size={17}/></span><span className="report-preview-copy"><strong>Daily stock report</strong><small>{dateLabel(report.report_date)}</small></span><StatusPill status={report.status}/><ChevronRight size={16} className="muted-icon"/></Link>)}</div> : <EmptyState icon={<FileText size={22}/>} title="No reports yet" message="Create your first daily stock report." action={<button className="link-button" onClick={() => void switchView('reports')}>Start a report <ArrowRight size={15}/></button>}/>}</section></div>
            <section className="panel movement-panel"><div className="panel-heading"><div><h3>Recent stock movements</h3><p>Latest changes recorded in the farm ledger.</p></div><button onClick={() => void switchView('history')} className="link-button">Full history <ArrowRight size={15}/></button></div><MovementTable movements={data?.recentMovements || []} compact/></section>
          </>}

          {view === 'livestock' && <>
            <div className="page-heading-row"><div><div className="page-kicker"><Warehouse size={15}/> STOCK REGISTER</div><h1>Livestock groups<span className="heading-period">.</span></h1><p>Manage sheep and goat categories with their opening balances and identifiers.</p></div><button onClick={() => setShowGroupForm((v) => !v)} className="btn btn-primary"><Plus size={17}/>{showGroupForm ? 'Close form' : 'Add livestock group'}</button></div>
            {showGroupForm && <section className="panel form-panel"><div className="panel-heading"><div><h3>Add a livestock group</h3><p>Opening quantity is recorded once as a starting balance. Create separate Sex = MALE/FEMALE and Category = NEWBORN groups to record newborns by sex.</p></div><button className="icon-button" onClick={() => setShowGroupForm(false)} aria-label="Close form"><X size={18}/></button></div><form className="form-grid" onSubmit={submitGroup}>
              <FormField label="Animal type"><select value={groupForm.type} onChange={(e) => setGroupForm({ ...groupForm, type: e.target.value })}><option value="SHEEP">Sheep</option><option value="GOAT">Goat</option></select></FormField>
              <FormField label="Breed"><input required maxLength={100} placeholder="e.g. Dorper, Red Maasai" value={groupForm.breed} onChange={(e) => setGroupForm({ ...groupForm, breed: e.target.value })}/></FormField>
              <FormField label="Sex"><select value={groupForm.sex} onChange={(e) => setGroupForm({ ...groupForm, sex: e.target.value })}><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="MIXED">Mixed</option></select></FormField>
              <FormField label="Category"><input required placeholder="e.g. Ewes, Ram, Lamb, Doe, Kids, NEWBORN" value={groupForm.category} onChange={(e) => setGroupForm({ ...groupForm, category: e.target.value })}/></FormField>
              <FormField label="Group name"><input required placeholder="e.g. GROUP 1" value={groupForm.groupName} onChange={(e) => setGroupForm({ ...groupForm, groupName: e.target.value })}/></FormField>
              <FormField label="Tip tag / identifier"><input placeholder="e.g. TIP TAG" value={groupForm.tipTag} onChange={(e) => setGroupForm({ ...groupForm, tipTag: e.target.value })}/></FormField>
              <FormField label="Tag colour"><input placeholder="e.g. RED, BLUE, YELLOW" value={groupForm.tagColour} onChange={(e) => setGroupForm({ ...groupForm, tagColour: e.target.value })}/></FormField>
              <FormField label="Opening quantity"><input required type="number" min="0" step="1" value={groupForm.openingQuantity} onChange={(e) => setGroupForm({ ...groupForm, openingQuantity: e.target.value })}/></FormField>
              <FormField label="Opening balance date"><input required type="date" value={groupForm.openingDate} max={data?.today} onChange={(e) => setGroupForm({ ...groupForm, openingDate: e.target.value })}/></FormField>
              <div className="form-actions full-width"><span className="form-footnote">Only add each group once. The initial stock creates an opening ledger entry.</span><button type="submit" disabled={busy} className="btn btn-primary">{busy ? 'Saving…' : 'Save livestock group'} <ArrowRight size={16}/></button></div>
            </form></section>}
            <section className="panel table-panel"><div className="panel-heading"><div><h3>All active groups <span className="subtle-count">{groups.length}</span></h3><p>Live quantity recalculated from the movement ledger.</p></div><div className="table-tools"><div className="search-box"><Search size={16}/><input placeholder="Search groups…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/></div><button className="icon-button" onClick={() => void loadData()} aria-label="Refresh groups"><RefreshCw size={17}/></button></div></div><div className="responsive-table"><table><thead><tr><th>Group / tag</th><th>Type &amp; breed</th><th>Sex</th><th>Category</th><th>Tag colour</th><th className="align-right">Live stock</th></tr></thead><tbody>{filteredGroups.map((group) => <tr key={group.id}><td><span className="table-group-name">{group.group_name}</span><small className="table-subtext">{group.tip_tag || 'No tag'}</small></td><td><span className={`animal-type-badge ${group.type.toLowerCase()}`}>{group.type === 'SHEEP' ? <PawPrint size={14}/> : <PawPrint size={14}/>} {group.type}</span><small className="table-subtext">{group.breed}</small></td><td>{capitalize(group.sex)}</td><td>{group.category}</td><td>{group.tag_colour || '—'}</td><td className="align-right"><strong className="stock-number">{fmt(group.live_stock)}</strong></td></tr>)}</tbody></table>{filteredGroups.length === 0 && <EmptyState icon={<Search size={22}/>} title="No matching groups" message={groups.length ? 'Try a different search term.' : 'Add livestock groups to start your stock register.'}/>}</div></section>
          </>}

          {view === 'reports' && <>
            <div className="page-heading-row"><div><div className="page-kicker"><FileText size={15}/> DAILY RECORDS</div><h1>Daily stock reports<span className="heading-period">.</span></h1><p>Save a report for each date, review quantities and finalize the stock movements once.</p></div></div>
            <section className="panel start-report-panel"><div className="start-report-copy"><span className="start-report-icon"><CalendarDays size={21}/></span><div><h3>Start a daily report</h3><p>Opening quantity is calculated from stock before the selected day. Transfers recorded for that date are included automatically.</p></div></div><form className="start-report-form" onSubmit={startReport}><FormField label="Report date"><input type="date" required max={data?.today} value={reportDate} onChange={(e) => setReportDate(e.target.value)}/></FormField><button className="btn btn-primary" type="submit" disabled={busy || !reportDate}>{busy ? 'Opening…' : 'Open report'} <ArrowRight size={16}/></button></form></section>
            <section className="panel table-panel"><div className="panel-heading"><div><h3>Report history <span className="subtle-count">{reports.length}</span></h3><p>Open drafts to continue editing, or view finalized snapshots.</p></div><button className="btn btn-soft btn-sm" onClick={() => void switchView('reports')}><RefreshCw size={15}/> Refresh</button></div><div className="report-card-grid">{reports.map((report) => <Link href={`/dashboard/reports/${report.id}`} key={report.id} className="report-card"><div className="report-card-top"><div className="report-card-icon"><FileText size={20}/></div><StatusPill status={report.status}/></div><span className="report-card-label">DAILY STOCK REPORT</span><h3>{dateLabel(report.report_date)}</h3><p>{report.status === 'FINALIZED' ? `Finalized ${report.finalized_at ? new Date(report.finalized_at).toLocaleDateString('en-GB') : ''}` : report.status === 'DRAFT' ? 'Draft · Ready to continue' : 'Voided report'}</p><div className="report-card-foot"><span>{report.status === 'FINALIZED' ? 'View snapshot' : 'Continue report'}</span><ArrowRight size={16}/></div></Link>)}</div>{!reports.length && <EmptyState icon={<FileText size={22}/>} title="Your report history starts here" message="Choose a date above to create the first report. No sample records have been added."/>}</section>
          </>}

          {view === 'transfers' && <>
            <div className="page-heading-row"><div><div className="page-kicker"><ArrowLeftRight size={15}/> STOCK MOVEMENTS</div><h1>Stock transfers<span className="heading-period">.</span></h1><p>Record movements between groups or when animals enter or leave the farm.</p></div></div>
            <section className="panel transfer-form-panel"><div className="panel-heading"><div><h3>Record a transfer</h3><p>Internal transfers post an equal decrease and increase as one atomic database operation.</p></div><span className="transfer-secure-mark"><ShieldCheck size={17}/> Balanced ledger</span></div><form className="form-grid" onSubmit={submitTransfer}>
              <FormField label="Transfer type"><select value={transferForm.mode} onChange={(e) => setTransferForm({ ...transferForm, mode: e.target.value, sourceGroupId: e.target.value === 'EXTERNAL_IN' ? '' : transferForm.sourceGroupId, destinationGroupId: e.target.value === 'EXTERNAL_OUT' ? '' : transferForm.destinationGroupId })}><option value="INTERNAL">Internal · group to group</option><option value="EXTERNAL_OUT">External · leaving the farm</option><option value="EXTERNAL_IN">External · entering the farm</option></select></FormField>
              {transferForm.mode !== 'EXTERNAL_IN' && <FormField label="Source group"><select required value={transferForm.sourceGroupId} onChange={(e) => setTransferForm({ ...transferForm, sourceGroupId: e.target.value })}><option value="">Select source group</option>{groups.filter((g) => transferForm.mode !== 'INTERNAL' || g.type === groups.find((v) => v.id === transferForm.destinationGroupId)?.type || !transferForm.destinationGroupId).map((g) => <option key={g.id} value={g.id}>{g.group_name} · {g.type} · {g.breed} · stock {fmt(g.live_stock)}</option>)}</select></FormField>}
              {transferForm.mode !== 'EXTERNAL_OUT' && <FormField label="Destination group"><select required value={transferForm.destinationGroupId} onChange={(e) => setTransferForm({ ...transferForm, destinationGroupId: e.target.value })}><option value="">Select destination group</option>{groups.filter((g) => transferForm.mode !== 'INTERNAL' || g.type === groups.find((v) => v.id === transferForm.sourceGroupId)?.type || !transferForm.sourceGroupId).map((g) => <option key={g.id} value={g.id}>{g.group_name} · {g.type} · {g.breed} · stock {fmt(g.live_stock)}</option>)}</select></FormField>}
              {transferForm.mode !== 'INTERNAL' && <FormField label={transferForm.mode === 'EXTERNAL_IN' ? 'Sending farm / source' : 'Receiving farm / destination'}><input required maxLength={180} placeholder="Enter farm or destination name" value={transferForm.externalParty} onChange={(e) => setTransferForm({ ...transferForm, externalParty: e.target.value })}/></FormField>}
              <FormField label="Quantity"><input required type="number" min="1" step="1" value={transferForm.quantity} onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })}/></FormField>
              <FormField label="Effective date"><input required type="date" max={data?.today} value={transferForm.effectiveDate} onChange={(e) => setTransferForm({ ...transferForm, effectiveDate: e.target.value })}/></FormField>
              <FormField label="Reference / notes"><input maxLength={1000} placeholder="Optional note or reference" value={transferForm.notes} onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}/></FormField>
              <div className="form-actions full-width"><span className="form-footnote">Transfers cannot be posted to a finalized report date. Source stock is validated.</span><button className="btn btn-primary" disabled={busy || !groups.length} type="submit">{busy ? 'Saving…' : 'Save transfer'} <ArrowRight size={16}/></button></div>
            </form></section>
            <section className="panel table-panel"><div className="panel-heading"><div><h3>Recent transfers</h3><p>Incoming and outgoing transfer ledger entries.</p></div><button className="btn btn-soft btn-sm" onClick={async () => { const result = await requestJson<{ transfers: Movement[] }>('/api/transfers'); setTransfers(result.transfers); }}><RefreshCw size={15}/> Refresh</button></div><MovementTable movements={transfers} compact={false}/>{!transfers.length && <EmptyState icon={<ArrowLeftRight size={22}/>} title="No transfers recorded" message="Your internal and external transfers will appear here."/>}</section>
          </>}

          {view === 'history' && <>
            <div className="page-heading-row"><div><div className="page-kicker"><Activity size={15}/> AUDITABLE STOCK LEDGER</div><h1>Movement history<span className="heading-period">.</span></h1><p>A chronological record of opening stock, births, additions, transfers, losses and sales.</p></div><button className="btn btn-soft" onClick={downloadMovements}><Download size={17}/> Export CSV</button></div>
            <section className="panel table-panel"><div className="panel-heading"><div><h3>All stock movements</h3><p>Showing the latest 500 ledger entries.</p></div><button className="btn btn-soft btn-sm" onClick={async () => { const result = await requestJson<{ movements: Movement[] }>('/api/movements'); setMovements(result.movements); }}><RefreshCw size={15}/> Refresh</button></div><MovementTable movements={movements} compact={false}/>{!movements.length && <EmptyState icon={<Activity size={22}/>} title="Movement ledger is empty" message="Opening balances will appear here after the first livestock group is created."/>}</section>
          </>}

          {view === 'settings' && <>
            <div className="page-heading-row"><div><div className="page-kicker"><Settings2 size={15}/> WORKSPACE SETTINGS</div><h1>Farm settings<span className="heading-period">.</span></h1><p>Review the farm profile, contact links and website support details.</p></div></div>
            <div className="settings-grid"><section className="panel settings-card"><span className="settings-symbol"><Sprout size={23}/></span><span className="settings-kicker">FARM PROFILE</span><h3>MESHUKO&apos;S S AND G FARM</h3><p>Sheep &amp; Goat Farm Record Keeping</p><div className="settings-detail"><span>Time zone</span><strong>Africa/Dar_es_Salaam</strong></div><div className="settings-detail"><span>Database</span><strong><span className="online-dot"/> Neon PostgreSQL</strong></div><div className="settings-detail"><span>Access model</span><strong>Single owner / admin</strong></div><div className="settings-detail"><span>Live groups</span><strong>{groups.length}</strong></div></section><section className="panel settings-card"><span className="settings-symbol settings-symbol-gold"><MessageIcon/></span><span className="settings-kicker">CONTACT &amp; SUPPORT</span><h3>Stay connected</h3><p>Contact channels configured for this website.</p><div className="settings-detail"><span>Farm WhatsApp</span><a href="https://wa.me/255783872819" target="_blank" rel="noreferrer">+255 783 872 819 <ArrowRight size={14}/></a></div><div className="settings-detail"><span>Website support</span><a href="mailto:buildwebtz@gmail.com">buildwebtz@gmail.com</a></div><div className="settings-detail"><span>Brell WhatsApp</span><a href="https://wa.me/255784452159" target="_blank" rel="noreferrer">+255 784 452 159</a></div><div className="settings-detail"><span>Site URL</span><strong>Configured in environment</strong></div></section></div>
            <section className="panel settings-security"><div className="settings-symbol"><ShieldCheck size={23}/></div><div><h3>Private by default</h3><p>No public signup page is enabled. Admin login credentials are read from server environment variables. Do not commit the real <code>.env</code> file to source control.</p></div><Link href="/login" className="btn btn-soft btn-sm">Admin login page <ArrowRight size={15}/></Link></section>
            <div className="brell-credit-panel"><span>Designed and built with care by</span><strong>BRELL</strong><a href="mailto:buildwebtz@gmail.com">buildwebtz@gmail.com</a><a href="https://wa.me/255784452159" target="_blank" rel="noreferrer">+255 784 452 159</a></div>
          </>}
        </>}
      </div>
      <footer className="admin-footer"><span>© {new Date().getFullYear()} MESHUKO&apos;S S AND G FARM</span><span>Website by <strong>BRELL</strong> · <a href="mailto:buildwebtz@gmail.com">buildwebtz@gmail.com</a></span></footer>
    </section>
  </main>;
}

function StatCard({ label, value, icon, note, accent }: { label: string; value: string; icon: ReactNode; note: string; accent: string }) {
  return <div className={`stat-card stat-${accent}`}><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><strong className="stat-value">{value}</strong><div className="stat-note"><span className="stat-note-dot"/>{note}</div></div>;
}
function FormField({ label, children }: { label: string; children: ReactNode }) { return <label className="form-field"><span>{label}</span>{children}</label>; }
function GroupRow({ group }: { group: Group }) {
  return <div className="group-preview-row"><span className={`group-animal-icon ${group.type.toLowerCase()}`}>{group.type === 'SHEEP' ? <PawPrint size={17}/> : <PawPrint size={17}/>}</span><span className="group-preview-copy"><strong>{group.group_name} <small>{group.tip_tag || ''}</small></strong><span>{group.breed} · {group.category} · {capitalize(group.sex)}</span></span><span className="group-stock-value">{fmt(group.live_stock)} <small>head</small></span></div>;
}
function StatusPill({ status }: { status: string }) { return <span className={`status-pill status-${status.toLowerCase()}`}><span/>{status === 'FINALIZED' ? 'Finalized' : status === 'DRAFT' ? 'Draft' : 'Voided'}</span>; }
function EmptyState({ icon, title, message, action }: { icon: ReactNode; title: string; message: string; action?: ReactNode }) { return <div className="empty-state"><div className="empty-state-icon">{icon}</div><strong>{title}</strong><p>{message}</p>{action}</div>; }
function MovementTable({ movements, compact }: { movements: Movement[]; compact: boolean }) {
  if (!movements.length) return <EmptyState icon={<Activity size={22}/>} title="Nothing recorded yet" message="When stock movements are created, they will show here."/>;
  return <div className="responsive-table"><table><thead><tr><th>Date</th><th>Movement</th><th>Animal group</th><th>Details</th><th className="align-right">Qty</th></tr></thead><tbody>{movements.map((m) => { const positive = ['OPENING','BIRTH','NEW_STOCK','TRANSFER_IN','ADJUSTMENT_IN'].includes(m.movement_type); return <tr key={m.id}><td>{dateLabel(m.effective_date)}</td><td><span className={`movement-type ${positive ? 'movement-positive' : 'movement-negative'}`}>{positive ? <TrendingUp size={14}/> : <TrendingDown size={14}/>} {movementLabels[m.movement_type] || m.movement_type}</span></td><td><strong className="table-group-name">{m.group_name}</strong><small className="table-subtext">{m.type} · {m.breed}</small></td><td><span>{m.external_party || m.notes || `${capitalize(m.sex)} · ${m.category}`}</span></td><td className={`align-right movement-quantity ${positive ? 'text-positive' : 'text-negative'}`}>{positive ? '+' : '−'}{fmt(m.quantity)}</td></tr>; })}</tbody></table>{compact && movements.length >= 8 && <div className="table-limited-note">Showing the most recent 8 entries.</div>}</div>;
}
function capitalize(input: string) { return input.toLowerCase().replace(/\b\w/g, (match) => match.toUpperCase()); }
function downloadMovements() {
  fetch('/api/movements').then((res) => res.json()).then((data: { movements?: Movement[] }) => {
    const rows = data.movements || [];
    const headers = ['Date', 'Movement', 'Type', 'Breed', 'Sex', 'Category', 'Group', 'Quantity', 'External party', 'Notes'];
    const csv = [headers, ...rows.map((m) => [m.effective_date, movementLabels[m.movement_type] || m.movement_type, m.type, m.breed, m.sex, m.category, m.group_name, m.quantity, m.external_party || '', m.notes || ''])]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'meshukos-stock-movements.csv'; anchor.click(); URL.revokeObjectURL(url);
  }).catch(() => window.alert('Imeshindikana ku-export movement history.'));
}
function MessageIcon() { return <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/></svg>; }
