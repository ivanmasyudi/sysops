import React, { useEffect, useState } from 'react';
import { 
  GitCommit, 
  GitPullRequest, 
  CheckCircle2, 
  BookOpen, 
  Clock,
  Calendar as CalendarIcon,
  ChevronDown,
  Github,
  AlertCircle,
  Sparkles,
  Users,
  Target,
  Kanban
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { format, subDays } from 'date-fns';

type ActivityPoint = {
  date: string;
  isoDate?: string;
  commits: number;
};

type PullRequestPoint = {
  date: string;
  isoDate?: string;
  Merged: number;
  Open: number;
  Closed: number;
};

type RecentEventItem = {
  id: number | string;
  type: 'commit' | 'pr' | 'issue';
  repo: string;
  message: string;
  time: string;
  url?: string;
  author?: string;
  icon?: React.ElementType;
};

type TopRepoItem = {
  name: string;
  commits: number;
  language: string;
  color?: string;
};

type WorkDistributionItem = {
  name: string;
  value: number;
  color: string;
};

type TeamMemberItem = {
  name: string;
  role: string;
  avatar: string;
  profileUrl?: string;
  contributions?: number;
};

type RepoProjectStatItem = {
  name: string;
  todo: number;
  inProgress: number;
  done: number;
  total: number;
};

type MilestoneItem = {
  title: string;
  progress: number;
  tasksCompleted: number;
  tasksTotal: number;
  dueDate: string;
  repo?: string;
  url?: string;
} | null;

type HeatmapDay = {
  date: string;
  count: number;
  intensity: number;
  isoDate?: string;
};

type DashboardPayload = {
  generatedAt: string;
  owner: string;
  selectedDays: number;
  summary: {
    systemUpdates: number;
    featuresDelivered: number;
    problemsOpen: number;
    problemsClosed: number;
    activeProjects: number;
  };
  executiveSummary: string;
  activityData: ActivityPoint[];
  prData: PullRequestPoint[];
  heatmapData: HeatmapDay[][];
  recentEvents: RecentEventItem[];
  topRepos: TopRepoItem[];
  workDistribution: WorkDistributionItem[];
  teamMembers: TeamMemberItem[];
  repoProjectStats: RepoProjectStatItem[];
  currentMilestone: MilestoneItem;
};

const API_BASE_URL =
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL ||
  (window.location.port === '3000' ? 'http://localhost:8787' : '');

const periodOptions = [
  { label: 'Last 7 Days', value: 7 },
  { label: 'Last 30 Days', value: 30 },
  { label: 'Last 90 Days', value: 90 },
  { label: 'Last 365 Days', value: 365 },
] as const;

// --- MOCK DATA ---
const generateActivityData = () => {
  const data = [];
  for (let i = 30; i >= 0; i--) {
    data.push({
      date: format(subDays(new Date(), i), 'MMM dd'),
      commits: Math.floor(Math.random() * 15) + 2,
    });
  }
  return data;
};

const fallbackActivityData: ActivityPoint[] = generateActivityData();

const fallbackRecentEvents: RecentEventItem[] = [
  { id: 1, type: 'commit', repo: 'core-api-service', message: 'feat: implement rate limiting for public endpoints', time: '10 mins ago', icon: GitCommit },
  { id: 2, type: 'pr', repo: 'frontend-dashboard', message: 'Merged PR #142: Refactor authentication flow', time: '2 hours ago', icon: GitPullRequest },
  { id: 3, type: 'issue', repo: 'payment-gateway', message: 'Resolved Issue #89: Webhook signature validation failing', time: '4 hours ago', icon: CheckCircle2 },
  { id: 4, type: 'commit', repo: 'core-api-service', message: 'fix: handle null pointer in user service', time: '5 hours ago', icon: GitCommit },
  { id: 5, type: 'commit', repo: 'infrastructure-as-code', message: 'chore: update terraform aws provider to v5.0', time: '1 day ago', icon: GitCommit },
];

const fallbackTopRepos: TopRepoItem[] = [
  { name: 'core-api-service', commits: 342, language: 'TypeScript', color: 'bg-blue-500' },
  { name: 'frontend-dashboard', commits: 215, language: 'React', color: 'bg-cyan-500' },
  { name: 'payment-gateway', commits: 189, language: 'Go', color: 'bg-emerald-500' },
  { name: 'infrastructure-as-code', commits: 76, language: 'HCL', color: 'bg-purple-500' },
];

const fallbackWorkDistribution: WorkDistributionItem[] = [
  { name: 'Fitur Baru (New Features)', value: 45, color: '#10b981' },
  { name: 'Perbaikan Eror (Bug Fixes)', value: 30, color: '#f59e0b' },
  { name: 'Pemeliharaan (Maintenance)', value: 25, color: '#3b82f6' },
];

const generatePrData = () => {
  const data = [];
  for (let i = 29; i >= 0; i--) {
    data.push({
      date: format(subDays(new Date(), i), 'MMM dd'),
      Merged: Math.floor(Math.random() * 4) + 1,
      Open: Math.floor(Math.random() * 3),
      Closed: Math.floor(Math.random() * 2),
    });
  }
  return data;
};

const fallbackPrData: PullRequestPoint[] = generatePrData();

const fallbackTeamMembers: TeamMemberItem[] = [
  { name: 'Ivan Masyudi', role: 'Lead Developer', avatar: 'https://i.pravatar.cc/150?u=ivan' },
  { name: 'Sarah Dev', role: 'Frontend Engineer', avatar: 'https://i.pravatar.cc/150?u=sarah' },
  { name: 'Budi Santoso', role: 'Backend Engineer', avatar: 'https://i.pravatar.cc/150?u=budi' },
  { name: 'Alex QA', role: 'Quality Assurance', avatar: 'https://i.pravatar.cc/150?u=alex' },
];

const fallbackCurrentMilestone: MilestoneItem = {
  title: 'Rilis Versi 2.0 (Payment Gateway Baru)',
  progress: 78,
  tasksCompleted: 45,
  tasksTotal: 58,
  dueDate: '25 April 2026'
};

const fallbackRepoProjectStats: RepoProjectStatItem[] = [
  { name: 'core-api-service', todo: 5, inProgress: 3, done: 15, total: 23 },
  { name: 'frontend-dashboard', todo: 8, inProgress: 4, done: 12, total: 24 },
  { name: 'payment-gateway', todo: 2, inProgress: 1, done: 8, total: 11 },
  { name: 'infrastructure-as-code', todo: 1, inProgress: 0, done: 5, total: 6 },
];

// Generate mock heatmap data (last 3 months approx)
const generateHeatmap = () => {
  const weeks = [];
  let currentDate = subDays(new Date(), 12 * 7 - 1);
  for (let i = 0; i < 12; i++) {
    const days = [];
    for (let j = 0; j < 7; j++) {
      const count = Math.random() > 0.3 ? Math.floor(Math.random() * 15) + 1 : 0;
      let intensity = 0;
      if (count > 0 && count <= 3) intensity = 1;
      else if (count > 3 && count <= 6) intensity = 2;
      else if (count > 6 && count <= 10) intensity = 3;
      else if (count > 10) intensity = 4;

      days.push({
        date: format(currentDate, 'MMM dd, yyyy'),
        count,
        intensity
      });
      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
    }
    weeks.push(days);
  }
  return weeks;
};

const fallbackHeatmapData: HeatmapDay[][] = generateHeatmap();

const fallbackDashboard: DashboardPayload = {
  generatedAt: new Date().toISOString(),
  owner: 'organization-account',
  selectedDays: 30,
  summary: {
    systemUpdates: 1432,
    featuresDelivered: 45,
    problemsOpen: 12,
    problemsClosed: 28,
    activeProjects: 4,
  },
  executiveSummary:
    'Mode demo aktif. Hubungkan backend GitHub untuk mengganti semua metrik mock menjadi data repository yang real.',
  activityData: fallbackActivityData,
  prData: fallbackPrData,
  heatmapData: fallbackHeatmapData,
  recentEvents: fallbackRecentEvents,
  topRepos: fallbackTopRepos,
  workDistribution: fallbackWorkDistribution,
  teamMembers: fallbackTeamMembers,
  repoProjectStats: fallbackRepoProjectStats,
  currentMilestone: fallbackCurrentMilestone,
};

// --- COMPONENTS ---

const StatCard = ({ title, value, trend, description, icon: Icon }: { title: string, value: string, trend: string, description: string, icon: React.ElementType }) => (
  <div className="bg-[#0a0a0a] border border-emerald-900/20 rounded-xl p-5 flex flex-col relative overflow-hidden group">
    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
      <Icon size={64} className="text-emerald-500" />
    </div>
    <div className="flex items-center gap-3 text-neutral-400 mb-1">
      <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
        <Icon size={18} className="text-emerald-500" />
      </div>
      <span className="font-medium text-sm">{title}</span>
    </div>
    <p className="text-xs text-neutral-500 mb-3">{description}</p>
    <div className="flex items-end gap-3 mt-auto">
      <span className="text-3xl font-bold text-neutral-100">{value}</span>
      <span className="text-emerald-500 text-sm font-medium mb-1 bg-emerald-500/10 px-2 py-0.5 rounded">{trend}</span>
    </div>
  </div>
);

const IssueStatCard = ({ title, open, closed, trend, description, icon: Icon }: { title: string, open: number, closed: number, trend: string, description: string, icon: React.ElementType }) => (
  <div className="bg-[#0a0a0a] border border-emerald-900/20 rounded-xl p-5 flex flex-col relative overflow-hidden group">
    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
      <Icon size={64} className="text-emerald-500" />
    </div>
    <div className="flex items-center gap-3 text-neutral-400 mb-1">
      <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
        <Icon size={18} className="text-emerald-500" />
      </div>
      <span className="font-medium text-sm">{title}</span>
    </div>
    <p className="text-xs text-neutral-500 mb-3">{description}</p>
    <div className="flex items-end justify-between gap-2 mt-auto">
      <div className="flex items-baseline gap-3">
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-neutral-100 leading-none">{open}</span>
          <span className="text-[10px] text-neutral-500 uppercase tracking-wider mt-1.5">Pending</span>
        </div>
        <span className="text-neutral-700 text-xl font-light">/</span>
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-neutral-100 leading-none">{closed}</span>
          <span className="text-[10px] text-neutral-500 uppercase tracking-wider mt-1.5">Resolved</span>
        </div>
      </div>
      <span className="text-emerald-500 text-xs font-medium mb-1 bg-emerald-500/10 px-2 py-0.5 rounded whitespace-nowrap">{trend}</span>
    </div>
  </div>
);

export default function App() {
  const [dashboard, setDashboard] = useState<DashboardPayload>(fallbackDashboard);
  const [selectedDays, setSelectedDays] = useState<number>(30);
  const [tooltip, setTooltip] = useState<{show: boolean, x: number, y: number, date: string, count: number}>({show: false, x: 0, y: 0, date: '', count: 0});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let refreshTimeout: number | null = null;

    const loadDashboard = async (isBackgroundRefresh: boolean) => {
      if (isBackgroundRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard?days=${selectedDays}`);
        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { error?: string; details?: string } | null;
          throw new Error(payload?.details ?? payload?.error ?? 'Failed to load GitHub dashboard data');
        }

        const payload = await response.json() as Partial<DashboardPayload>;
        if (!cancelled) {
          setDashboard({
            ...fallbackDashboard,
            ...payload,
            selectedDays:
              typeof payload.selectedDays === 'number' && Number.isFinite(payload.selectedDays)
                ? payload.selectedDays
                : selectedDays,
          });
          setUsingFallback(false);
          setError(null);
        }
      } catch (requestError) {
        if (!cancelled) {
          setUsingFallback(true);
          setError(requestError instanceof Error ? requestError.message : 'Unknown dashboard error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    void loadDashboard(false);
    const intervalId = window.setInterval(() => {
      void loadDashboard(true);
    }, 60_000);

    const eventSource = new EventSource(`${API_BASE_URL}/api/events`);
    eventSource.addEventListener('dashboard-refresh', () => {
      if (refreshTimeout !== null) {
        window.clearTimeout(refreshTimeout);
      }

      refreshTimeout = window.setTimeout(() => {
        void loadDashboard(true);
      }, 500);
    });

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      if (refreshTimeout !== null) {
        window.clearTimeout(refreshTimeout);
      }
      eventSource.close();
    };
  }, [selectedDays]);

  const generatedAtLabel = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(dashboard.generatedAt));

  const activityData = dashboard.activityData;
  const recentEvents = dashboard.recentEvents;
  const topRepos = dashboard.topRepos.map((repo, index) => ({
    ...repo,
    color: repo.color ?? fallbackTopRepos[index % fallbackTopRepos.length]?.color ?? 'bg-emerald-500',
  }));
  const workDistribution = dashboard.workDistribution;
  const prData = dashboard.prData;
  const teamMembers = dashboard.teamMembers;
  const currentMilestone = dashboard.currentMilestone;
  const repoProjectStats = dashboard.repoProjectStats;
  const heatmapData = dashboard.heatmapData;
  const repoCommitMax = Math.max(...topRepos.map((repo) => repo.commits), 1);
  const commitTrend = activityData.length > 7
    ? `${activityData[activityData.length - 1].commits - activityData[activityData.length - 8].commits >= 0 ? '+' : ''}${activityData[activityData.length - 1].commits - activityData[activityData.length - 8].commits} vs minggu lalu`
    : 'Live sync';
  const selectedPeriodLabel =
    periodOptions.find((option) => option.value === selectedDays)?.label ?? `Last ${selectedDays || 30} Days`;

  return (
    <div className="min-h-screen bg-[#050505] text-neutral-200 font-sans selection:bg-emerald-500/30">
      
      {/* HEADER */}
      <header className="border-b border-emerald-900/20 bg-[#0a0a0a] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)]">
              <Users size={20} className="text-black" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Tim Pengembang (Engineering Team)</h1>
              <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                <Github size={12} /> @{dashboard.owner} &bull; {dashboard.summary.activeProjects} Active Repositories
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex items-center px-3 py-2 bg-[#050505] border border-emerald-900/30 rounded-lg text-sm font-medium text-neutral-300">
              <CalendarIcon size={16} className="text-emerald-500" />
              <select
                value={selectedDays}
                onChange={(event) => setSelectedDays(Number(event.target.value))}
                className="appearance-none bg-transparent text-neutral-200 outline-none cursor-pointer pl-2 pr-8"
              >
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-[#0a0a0a] text-neutral-200">
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 text-neutral-500 pointer-events-none" />
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-lg text-sm font-semibold">
              <Clock size={16} />
              {refreshing ? 'Refreshing...' : generatedAtLabel}
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="p-6 md:p-8 flex flex-col gap-8 max-w-7xl mx-auto w-full">
        {loading && (
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl px-5 py-4 text-sm text-neutral-300">
            Memuat data dashboard dari backend GitHub...
          </div>
        )}

        {error && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-4 text-sm text-amber-100">
            <span className="font-semibold">Mode fallback aktif.</span> {error}
          </div>
        )}
        
        {/* EXECUTIVE SUMMARY */}
        <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-emerald-500/20 rounded-lg shrink-0">
              <Sparkles className="text-emerald-400" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h2 className="text-lg font-bold text-white">Ringkasan Eksekutif (Executive Summary)</h2>
                <span className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/80">
                  {usingFallback ? 'Demo Data' : 'GitHub Live Data'}
                </span>
              </div>
              <p className="text-neutral-300 leading-relaxed text-sm">{dashboard.executiveSummary}</p>
            </div>
          </div>
        </div>

        {/* STATS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            title="System Updates" 
            description="Pembaruan kode & sistem"
            value={dashboard.summary.systemUpdates.toLocaleString('en-US')} 
            trend={commitTrend} 
            icon={GitCommit} 
          />
          <StatCard 
            title="Features Delivered" 
            description="Fitur baru yang dirilis"
            value={dashboard.summary.featuresDelivered.toLocaleString('en-US')} 
            trend="Merged PR" 
            icon={GitPullRequest} 
          />
          <IssueStatCard 
            title="Problems Fixed" 
            description="Masalah/Eror yang ditangani"
            open={dashboard.summary.problemsOpen} 
            closed={dashboard.summary.problemsClosed} 
            trend="GitHub Issues" 
            icon={AlertCircle} 
          />
          <StatCard 
            title="Active Projects" 
            description="Proyek yang sedang dikerjakan"
            value={dashboard.summary.activeProjects.toLocaleString('en-US')} 
            trend={usingFallback ? 'Demo mode' : 'Connected'} 
            icon={BookOpen} 
          />
        </div>

        {/* CHARTS SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* MAIN ACTIVITY CHART */}
          <div className="lg:col-span-2 bg-[#0a0a0a] border border-emerald-900/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-white">Tren Produktivitas (Productivity Trend)</h2>
                <p className="text-xs text-neutral-500 mt-1">Intensitas pembaruan sistem untuk {selectedPeriodLabel.toLowerCase()}</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-neutral-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                Live Sync
              </div>
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCommits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#525252" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    minTickGap={20}
                  />
                  <YAxis 
                    stroke="#525252" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#065f46', borderRadius: '8px', color: '#e5e5e5' }}
                    itemStyle={{ color: '#10b981' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="commits" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorCommits)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* WORK DISTRIBUTION PIE CHART */}
          <div className="bg-[#0a0a0a] border border-emerald-900/20 rounded-xl p-6 flex flex-col">
            <div>
              <h2 className="text-lg font-semibold text-white">Fokus Pekerjaan</h2>
              <p className="text-xs text-neutral-500 mt-1">Distribusi waktu & tenaga tim</p>
            </div>
            <div className="flex-1 flex items-center justify-center mt-4">
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={workDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {workDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#065f46', borderRadius: '8px', color: '#e5e5e5' }}
                      itemStyle={{ color: '#e5e5e5' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              {workDistribution.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }}></div>
                    <span className="text-neutral-300">{item.name}</span>
                  </div>
                  <span className="font-medium text-white">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* PULL REQUEST BAR CHART */}
          <div className="lg:col-span-3 bg-[#0a0a0a] border border-emerald-900/20 rounded-xl p-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Siklus Fitur & Perbaikan (Pull Request Lifecycle)</h2>
              <p className="text-xs text-neutral-500 mt-1 mb-6">Status Pull Request untuk {selectedPeriodLabel.toLowerCase()}</p>
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={prData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#525252" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    minTickGap={20}
                  />
                  <YAxis 
                    stroke="#525252" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#065f46', borderRadius: '8px', color: '#e5e5e5' }}
                    cursor={{ fill: '#1a1a1a' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="Merged" stackId="a" fill="#8b5cf6" />
                  <Bar dataKey="Open" stackId="a" fill="#10b981" />
                  <Bar dataKey="Closed" stackId="a" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CONTRIBUTION HEATMAP */}
          <div className="lg:col-span-3 bg-[#0a0a0a] border border-emerald-900/20 rounded-xl p-6 flex flex-col">
            <div>
              <h2 className="text-lg font-semibold text-white mb-6">Konsistensi Harian (Daily Consistency)</h2>
              <p className="text-xs text-neutral-500 mt-1 -mt-5 mb-6">Bukti rekam jejak pekerjaan untuk {selectedPeriodLabel.toLowerCase()}</p>
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <div className="flex gap-1.5 overflow-x-auto pb-2">
                {heatmapData.map((week, i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    {week.map((day, j) => {
                      // Map intensity to Tailwind colors
                      const colors = [
                        'bg-neutral-900', // 0
                        'bg-emerald-900/40', // 1
                        'bg-emerald-700/60', // 2
                        'bg-emerald-500/80', // 3
                        'bg-emerald-400', // 4
                      ];
                      return (
                        <div 
                          key={j} 
                          className={`w-3.5 h-3.5 rounded-sm ${colors[day.intensity]} transition-colors hover:ring-1 hover:ring-emerald-300 cursor-pointer`}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltip({
                              show: true,
                              x: rect.left + rect.width / 2,
                              y: rect.top - 8,
                              date: day.date,
                              count: day.count
                            });
                          }}
                          onMouseLeave={() => setTooltip(prev => ({...prev, show: false}))}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-end gap-2 mt-4 text-xs text-neutral-500">
                <span>Less</span>
                <div className="flex gap-1">
                  <div className="w-3 h-3 rounded-sm bg-neutral-900"></div>
                  <div className="w-3 h-3 rounded-sm bg-emerald-900/40"></div>
                  <div className="w-3 h-3 rounded-sm bg-emerald-700/60"></div>
                  <div className="w-3 h-3 rounded-sm bg-emerald-500/80"></div>
                  <div className="w-3 h-3 rounded-sm bg-emerald-400"></div>
                </div>
                <span>More</span>
              </div>
            </div>
          </div>

        </div>

        {/* BOTTOM SECTION ROW 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* RECENT ACTIVITY */}
          <div className="lg:col-span-2 bg-[#0a0a0a] border border-emerald-900/20 rounded-xl p-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Pembaruan Terbaru (Recent Updates)</h2>
              <p className="text-xs text-neutral-500 mt-1 mb-6">Log aktivitas detail dari GitHub untuk {selectedPeriodLabel.toLowerCase()}</p>
            </div>
            <div className="flex flex-col gap-4">
              {recentEvents.map((event) => (
                <a
                  key={event.id}
                  href={event.url ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="flex gap-4 p-3 hover:bg-neutral-900/50 rounded-lg transition-colors border border-transparent hover:border-emerald-900/20"
                >
                  <div className="mt-1">
                    <div className="p-2 bg-neutral-900 rounded-full border border-neutral-800">
                      {event.type === 'commit' && <GitCommit size={16} className="text-blue-400" />}
                      {event.type === 'pr' && <GitPullRequest size={16} className="text-purple-400" />}
                      {event.type === 'issue' && <CheckCircle2 size={16} className="text-emerald-400" />}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-xs font-medium text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                        {event.repo}
                      </span>
                      <span className="text-xs text-neutral-500 flex items-center gap-1">
                        <Clock size={12} /> {event.time}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-200">{event.message}</p>
                    {event.author && <p className="text-xs text-neutral-500 mt-1">by {event.author}</p>}
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* TOP REPOSITORIES */}
          <div className="bg-[#0a0a0a] border border-emerald-900/20 rounded-xl p-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Proyek Aktif (Active Projects)</h2>
              <p className="text-xs text-neutral-500 mt-1 mb-6">Repo paling aktif untuk {selectedPeriodLabel.toLowerCase()}</p>
            </div>
            <div className="flex flex-col gap-5">
              {topRepos.map((repo, idx) => (
                <div key={idx} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-200">{repo.name}</span>
                    <span className="text-xs text-neutral-500">{repo.commits} commits</span>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${repo.color}`} 
                      style={{ width: `${(repo.commits / repoCommitMax) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-neutral-500">{repo.language}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* PROJECT BOARD PROGRESS */}
        <div className="bg-[#0a0a0a] border border-emerald-900/20 rounded-xl p-6 mt-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Kanban size={20} className="text-emerald-500" />
                Status Papan Proyek (Project Board Progress)
              </h2>
              <p className="text-xs text-neutral-500 mt-1">Pergerakan tugas berdasarkan repositori</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {repoProjectStats.map((repo, idx) => (
              <div key={idx} className="bg-neutral-900/30 border border-neutral-800 rounded-lg p-5 hover:border-emerald-900/30 transition-colors">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-medium text-neutral-200">{repo.name}</span>
                  <span className="text-xs text-neutral-500">{repo.total} tasks</span>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full h-2 bg-neutral-950 rounded-full overflow-hidden flex mb-4 border border-neutral-800">
                  <div className="h-full bg-emerald-500" style={{ width: `${(repo.done / repo.total) * 100}%` }} title="Done"></div>
                  <div className="h-full bg-blue-500" style={{ width: `${(repo.inProgress / repo.total) * 100}%` }} title="In Progress"></div>
                  <div className="h-full bg-neutral-600" style={{ width: `${(repo.todo / repo.total) * 100}%` }} title="To Do"></div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="flex flex-col">
                    <span className="text-lg font-bold text-emerald-400">{repo.done}</span>
                    <span className="text-[10px] text-neutral-500 uppercase tracking-wider mt-0.5">Done</span>
                  </div>
                  <div className="flex flex-col border-x border-neutral-800">
                    <span className="text-lg font-bold text-blue-400">{repo.inProgress}</span>
                    <span className="text-[10px] text-neutral-500 uppercase tracking-wider mt-0.5">In Progress</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-lg font-bold text-neutral-400">{repo.todo}</span>
                    <span className="text-[10px] text-neutral-500 uppercase tracking-wider mt-0.5">To Do</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* BOTTOM SECTION ROW 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          
          {/* MILESTONE / TARGET RILIS */}
          <div className="lg:col-span-2 bg-[#0a0a0a] border border-emerald-900/20 rounded-xl p-6 flex flex-col justify-center">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Target size={20} className="text-emerald-500" />
                  Target Rilis Terdekat (Current Milestone)
                </h2>
                <p className="text-xs text-neutral-500 mt-1">Milestone terbuka terdekat dari GitHub</p>
              </div>
              {currentMilestone && (
                <div className="text-right">
                  <span className="text-xs text-neutral-500 block mb-1">Tenggat Waktu (Due Date)</span>
                  <span className="text-sm font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                    {currentMilestone.dueDate}
                  </span>
                </div>
              )}
            </div>
            
            {currentMilestone ? (
              <a href={currentMilestone.url ?? '#'} target="_blank" rel="noreferrer" className="bg-neutral-900/50 rounded-lg p-5 border border-neutral-800 hover:border-emerald-900/30 transition-colors">
                <div className="flex justify-between items-end mb-3">
                  <div>
                    <h3 className="text-base font-medium text-white">{currentMilestone.title}</h3>
                    {currentMilestone.repo && <p className="text-xs text-neutral-500 mt-1">Repo: {currentMilestone.repo}</p>}
                  </div>
                  <span className="text-2xl font-bold text-emerald-500">{currentMilestone.progress}%</span>
                </div>

                <div className="h-3 w-full bg-neutral-950 rounded-full overflow-hidden mb-3 border border-neutral-800">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full relative" 
                    style={{ width: `${currentMilestone.progress}%` }}
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px] animate-[shimmer_2s_linear_infinite]"></div>
                  </div>
                </div>
                
                <div className="flex justify-between text-xs text-neutral-400">
                  <span>Progress Pengerjaan</span>
                  <span>{currentMilestone.tasksCompleted} dari {currentMilestone.tasksTotal} Tugas Selesai</span>
                </div>
              </a>
            ) : (
              <div className="bg-neutral-900/50 rounded-lg p-5 border border-neutral-800 text-sm text-neutral-400">
                Belum ada milestone terbuka yang terdeteksi dari repositori GitHub yang dipantau.
              </div>
            )}
          </div>

          {/* TEAM MEMBERS */}
          <div className="bg-[#0a0a0a] border border-emerald-900/20 rounded-xl p-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Tim Pengembang</h2>
              <p className="text-xs text-neutral-500 mt-1 mb-6">Kontributor paling aktif untuk {selectedPeriodLabel.toLowerCase()}</p>
            </div>
            <div className="flex flex-col gap-4">
              {teamMembers.map((member, idx) => (
                <a key={idx} href={member.profileUrl ?? '#'} target="_blank" rel="noreferrer" className="flex items-center gap-3">
                  <img 
                    src={member.avatar} 
                    alt={member.name} 
                    className="w-10 h-10 rounded-full border border-emerald-900/50"
                  />
                  <div>
                    <h4 className="text-sm font-medium text-neutral-200">{member.name}</h4>
                    <p className="text-xs text-neutral-500">
                      {member.role}{member.contributions ? ` • ${member.contributions} contributions` : ''}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>

      </main>

      {/* FIXED TOOLTIP */}
      {tooltip.show && (
        <div 
          className="fixed z-50 pointer-events-none flex flex-col items-center transform -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="bg-[#0a0a0a] border border-emerald-900/50 text-neutral-200 text-xs py-1.5 px-2.5 rounded shadow-xl whitespace-nowrap">
            <span className="font-semibold text-emerald-400">{tooltip.count} contributions</span> on {tooltip.date}
          </div>
          <div className="w-2 h-2 bg-[#0a0a0a] border-b border-r border-emerald-900/50 transform rotate-45 -mt-1.5"></div>
        </div>
      )}
    </div>
  );
}
