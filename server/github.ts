import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';

type GithubRepo = {
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  language: string | null;
  open_issues_count: number;
  owner: {
    login: string;
  };
};

type GithubCommit = {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: {
      date: string;
      name: string;
    };
  };
  author: {
    login: string;
    avatar_url: string;
    html_url: string;
  } | null;
  repository?: {
    name: string;
  };
};

type GithubPullRequest = {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: 'open' | 'closed';
  created_at: string;
  closed_at: string | null;
  merged_at: string | null;
  updated_at: string;
  user: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
  labels: Array<{ name: string }>;
};

type GithubIssue = {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: 'open' | 'closed';
  created_at: string;
  closed_at: string | null;
  updated_at: string;
  user: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
  labels: Array<{ name: string }>;
  pull_request?: unknown;
};

type GithubMilestone = {
  id: number;
  title: string;
  description: string | null;
  due_on: string | null;
  open_issues: number;
  closed_issues: number;
  html_url: string;
};

type DailyPoint = {
  date: string;
  isoDate: string;
  commits: number;
};

type PullRequestPoint = {
  date: string;
  isoDate: string;
  Merged: number;
  Open: number;
  Closed: number;
};

type HeatmapDay = {
  date: string;
  isoDate: string;
  count: number;
  intensity: number;
};

type HeatmapWeek = HeatmapDay[];

type RecentEvent = {
  id: string;
  type: 'commit' | 'pr' | 'issue';
  repo: string;
  message: string;
  time: string;
  url: string;
  author: string;
  timestamp: string;
};

type TopRepo = {
  name: string;
  commits: number;
  language: string;
};

type TeamMember = {
  name: string;
  role: string;
  avatar: string;
  profileUrl: string;
  contributions: number;
};

type RepoProjectStat = {
  name: string;
  todo: number;
  inProgress: number;
  done: number;
  total: number;
};

type WorkDistribution = {
  name: string;
  value: number;
  color: string;
};

type CurrentMilestone = {
  title: string;
  progress: number;
  tasksCompleted: number;
  tasksTotal: number;
  dueDate: string;
  repo: string;
  url: string;
} | null;

export type DashboardPayload = {
  generatedAt: string;
  owner: string;
  selectedDays: number;
  repos: GithubRepo[];
  summary: {
    systemUpdates: number;
    featuresDelivered: number;
    problemsOpen: number;
    problemsClosed: number;
    activeProjects: number;
  };
  executiveSummary: string;
  activityData: DailyPoint[];
  prData: PullRequestPoint[];
  heatmapData: HeatmapWeek[];
  recentEvents: RecentEvent[];
  topRepos: TopRepo[];
  workDistribution: WorkDistribution[];
  teamMembers: TeamMember[];
  repoProjectStats: RepoProjectStat[];
  currentMilestone: CurrentMilestone;
};

type FetchOptions = {
  owner: string;
  repos: string[];
  token: string;
  days: number;
};

type RepoAggregate = {
  topRepo: TopRepo;
  recentEvents: RecentEvent[];
  contributors: TeamMember[];
  repoProjectStat: RepoProjectStat;
  milestones: Array<{ repo: string; milestone: GithubMilestone }>;
  workCounters: {
    feature: number;
    fix: number;
    maintenance: number;
  };
  mergedPrs: number;
  openIssues: number;
  closedIssues: number;
  commitBuckets: Map<string, number>;
  prBuckets: Map<string, { merged: number; open: number; closed: number }>;
  heatmapBuckets: Map<string, number>;
};

type CacheEntry = {
  expiresAt: number;
  payload: DashboardPayload;
  warmedAt: number;
  source: 'request' | 'webhook-preload';
};

type DashboardTimings = {
  totalMs: number;
  resolveReposMs: number;
  aggregateReposMs: number;
  assemblePayloadMs: number;
  repoCount: number;
  cacheStatus: 'hit' | 'miss';
  selectedDays: number;
};

const GITHUB_API_BASE = 'https://api.github.com';
const DAY = 24 * 60 * 60 * 1000;
const COLORS = {
  feature: '#10b981',
  fix: '#f59e0b',
  maintenance: '#3b82f6',
};

const cache = new Map<string, CacheEntry>();
const DEFAULT_CACHE_TTL_MS = 60 * 1000;

function createCacheKey(owner: string, repos: string[], days: number): string {
  return JSON.stringify({
    owner,
    repos: [...repos].sort(),
    days,
  });
}

function logDashboardTimings(label: string, timings: DashboardTimings): void {
  console.log(
    `[dashboard:${label}] cache=${timings.cacheStatus} days=${timings.selectedDays} repos=${timings.repoCount} total=${timings.totalMs.toFixed(0)}ms resolveRepos=${timings.resolveReposMs.toFixed(0)}ms aggregateRepos=${timings.aggregateReposMs.toFixed(0)}ms assemble=${timings.assemblePayloadMs.toFixed(0)}ms`,
  );
}

function getAuthHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'devproof-dashboard',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function githubRequest<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

async function resolveRepos(owner: string, token: string, configuredRepos: string[]): Promise<GithubRepo[]> {
  if (configuredRepos.length > 0) {
    const repos = await Promise.all(
      configuredRepos.map((repo) => githubRequest<GithubRepo>(`/repos/${owner}/${repo}`, token)),
    );
    return repos;
  }

  try {
    return await githubRequest<GithubRepo[]>(`/orgs/${owner}/repos?per_page=100&type=all&sort=updated`, token);
  } catch {
    return githubRequest<GithubRepo[]>(`/users/${owner}/repos?per_page=100&type=owner&sort=updated`, token);
  }
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(date);
}

function formatDateLong(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatDueDate(input: string | null): string {
  if (!input) {
    return 'No due date';
  }

  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(input));
}

function getRelativeTime(input: string): string {
  const deltaMs = Date.now() - new Date(input).getTime();
  const minutes = Math.max(1, Math.round(deltaMs / (60 * 1000)));
  if (minutes < 60) return `${minutes} mins ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return `${days} days ago`;
}

function createEmptyDailySeries(days: number): DailyPoint[] {
  const today = startOfDay(new Date());
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today.getTime() - (days - 1 - index) * DAY);
    return {
      date: formatLabel(date),
      isoDate: date.toISOString(),
      commits: 0,
    };
  });
}

function createEmptyPrSeries(days: number): PullRequestPoint[] {
  const today = startOfDay(new Date());
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today.getTime() - (days - 1 - index) * DAY);
    return {
      date: formatLabel(date),
      isoDate: date.toISOString(),
      Merged: 0,
      Open: 0,
      Closed: 0,
    };
  });
}

function createEmptyHeatmap(weeks: number): HeatmapWeek[] {
  const totalDays = weeks * 7;
  const start = startOfDay(new Date(Date.now() - (totalDays - 1) * DAY));
  const days = Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY);
    return {
      date: formatDateLong(date),
      isoDate: date.toISOString(),
      count: 0,
      intensity: 0,
    };
  });

  const weeksData: HeatmapWeek[] = [];
  for (let week = 0; week < weeks; week += 1) {
    weeksData.push(days.slice(week * 7, week * 7 + 7));
  }
  return weeksData;
}

function normalizeDays(days: number): number {
  if (!Number.isFinite(days)) return 30;
  if (days <= 7) return 7;
  if (days <= 30) return 30;
  if (days <= 90) return 90;
  return 365;
}

function scoreIntensity(count: number): number {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

function classifyWork(text: string, labels: string[]): 'feature' | 'fix' | 'maintenance' {
  const haystack = `${text} ${labels.join(' ')}`.toLowerCase();
  if (/(fix|bug|error|incident|hotfix|defect|patch)/.test(haystack)) {
    return 'fix';
  }
  if (/(feat|feature|add|implement|launch|release|enhancement)/.test(haystack)) {
    return 'feature';
  }
  return 'maintenance';
}

async function fetchRepoCommits(owner: string, repo: string, token: string, sinceIso: string) {
  return githubRequest<GithubCommit[]>(
    `/repos/${owner}/${repo}/commits?per_page=100&since=${encodeURIComponent(sinceIso)}`,
    token,
  );
}

async function fetchRepoPulls(owner: string, repo: string, token: string) {
  return githubRequest<GithubPullRequest[]>(
    `/repos/${owner}/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=100`,
    token,
  );
}

async function fetchRepoIssues(owner: string, repo: string, token: string) {
  return githubRequest<GithubIssue[]>(
    `/repos/${owner}/${repo}/issues?state=all&sort=updated&direction=desc&per_page=100`,
    token,
  );
}

async function fetchRepoMilestones(owner: string, repo: string, token: string) {
  return githubRequest<GithubMilestone[]>(
    `/repos/${owner}/${repo}/milestones?state=open&sort=due_on&direction=asc&per_page=10`,
    token,
  );
}

async function collectRepoAggregate(
  owner: string,
  repo: GithubRepo,
  token: string,
  since: string,
): Promise<RepoAggregate> {
  const [commits, pulls, issues, repoMilestones] = await Promise.all([
    fetchRepoCommits(owner, repo.name, token, since),
    fetchRepoPulls(owner, repo.name, token),
    fetchRepoIssues(owner, repo.name, token),
    fetchRepoMilestones(owner, repo.name, token).catch(() => []),
  ]);

  const rangeStartMs = new Date(since).getTime();
  const recentEvents: RecentEvent[] = [];
  const contributors = new Map<string, TeamMember>();
  const commitBuckets = new Map<string, number>();
  const prBuckets = new Map<string, { merged: number; open: number; closed: number }>();
  const heatmapBuckets = new Map<string, number>();
  const workCounters = { feature: 0, fix: 0, maintenance: 0 };

  let mergedPrs = 0;
  let openIssues = 0;
  let closedIssues = 0;

  commits.forEach((commit) => {
    const key = commit.commit.author.date.slice(0, 10);
    commitBuckets.set(key, (commitBuckets.get(key) ?? 0) + 1);
    heatmapBuckets.set(key, (heatmapBuckets.get(key) ?? 0) + 1);

    const category = classifyWork(commit.commit.message, []);
    workCounters[category] += 1;

    recentEvents.push({
      id: commit.sha,
      type: 'commit',
      repo: repo.name,
      message: commit.commit.message.split('\n')[0],
      time: getRelativeTime(commit.commit.author.date),
      url: commit.html_url,
      author: commit.author?.login ?? commit.commit.author.name,
      timestamp: commit.commit.author.date,
    });

    const contributorKey = commit.author?.login ?? commit.commit.author.name;
    const existingContributor = contributors.get(contributorKey);
    if (existingContributor) {
      existingContributor.contributions += 1;
    } else {
      contributors.set(contributorKey, {
        name: contributorKey,
        role: 'Contributor',
        avatar:
          commit.author?.avatar_url ??
          `https://ui-avatars.com/api/?name=${encodeURIComponent(contributorKey)}&background=0f172a&color=ffffff`,
        profileUrl: commit.author?.html_url ?? '#',
        contributions: 1,
      });
    }
  });

  pulls
    .filter((pull) => new Date(pull.updated_at).getTime() >= rangeStartMs)
    .forEach((pull) => {
      const createdKey = pull.created_at.slice(0, 10);
      const closedKey = pull.closed_at?.slice(0, 10);
      const mergedKey = pull.merged_at?.slice(0, 10);
      const bucket = prBuckets.get(createdKey) ?? { merged: 0, open: 0, closed: 0 };
      bucket.open += 1;
      prBuckets.set(createdKey, bucket);

      if (closedKey) {
        const closedBucket = prBuckets.get(closedKey) ?? { merged: 0, open: 0, closed: 0 };
        closedBucket.closed += 1;
        prBuckets.set(closedKey, closedBucket);
      }

      if (mergedKey) {
        const mergedBucket = prBuckets.get(mergedKey) ?? { merged: 0, open: 0, closed: 0 };
        mergedBucket.merged += 1;
        prBuckets.set(mergedKey, mergedBucket);
        mergedPrs += 1;
      }

      const category = classifyWork(
        pull.title,
        pull.labels.map((label) => label.name),
      );
      workCounters[category] += 1;

      recentEvents.push({
        id: `pr-${pull.id}`,
        type: 'pr',
        repo: repo.name,
        message: `PR #${pull.number}: ${pull.title}`,
        time: getRelativeTime(pull.updated_at),
        url: pull.html_url,
        author: pull.user.login,
        timestamp: pull.updated_at,
      });
    });

  const filteredIssues = issues
    .filter((issue) => !issue.pull_request)
    .filter((issue) => new Date(issue.updated_at).getTime() >= rangeStartMs);

  filteredIssues.forEach((issue) => {
    if (issue.state === 'open') openIssues += 1;
    if (issue.closed_at) closedIssues += 1;

    const category = classifyWork(
      issue.title,
      issue.labels.map((label) => label.name),
    );
    workCounters[category] += 1;

    recentEvents.push({
      id: `issue-${issue.id}`,
      type: 'issue',
      repo: repo.name,
      message: `Issue #${issue.number}: ${issue.title}`,
      time: getRelativeTime(issue.updated_at),
      url: issue.html_url,
      author: issue.user.login,
      timestamp: issue.updated_at,
    });
  });

  const done = pulls.filter((pull) => Boolean(pull.merged_at) && new Date(pull.updated_at).getTime() >= rangeStartMs).length;
  const inProgress = pulls.filter((pull) => pull.state === 'open' && new Date(pull.updated_at).getTime() >= rangeStartMs).length;
  const todo = filteredIssues.filter((issue) => issue.state === 'open').length;

  return {
    topRepo: {
      name: repo.name,
      commits: commits.length,
      language: repo.language ?? 'Unknown',
    },
    recentEvents,
    contributors: Array.from(contributors.values()),
    repoProjectStat: {
      name: repo.name,
      todo,
      inProgress,
      done,
      total: todo + inProgress + done,
    },
    milestones: repoMilestones.map((milestone) => ({ repo: repo.name, milestone })),
    workCounters,
    mergedPrs,
    openIssues,
    closedIssues,
    commitBuckets,
    prBuckets,
    heatmapBuckets,
  };
}

function buildExecutiveSummary(payload: DashboardPayload): string {
  const topRepo = payload.topRepos[0];
  const milestone = payload.currentMilestone;
  const rangeLabel = payload.selectedDays === 365 ? '365 hari terakhir' : `${payload.selectedDays} hari terakhir`;
  const repoLine = topRepo
    ? `${topRepo.name} menjadi repo paling aktif dengan ${topRepo.commits} commit dalam ${rangeLabel}.`
    : 'Belum ada repo aktif yang terbaca dari konfigurasi saat ini.';
  const milestoneLine = milestone
    ? `Milestone terdekat adalah ${milestone.title} dengan progres ${milestone.progress}%.`
    : 'Belum ada milestone terbuka yang terdeteksi.';

  return `Dashboard ini menampilkan data GitHub real dari ${payload.summary.activeProjects} repo aktif. Dalam ${rangeLabel} tercatat ${payload.summary.systemUpdates} commit, ${payload.summary.featuresDelivered} pull request merged, dan ${payload.summary.problemsClosed} issue terselesaikan. ${repoLine} ${milestoneLine}`;
}

export function clearDashboardCache(): void {
  cache.clear();
}

export function getDashboardCacheStats(): { entries: number; keys: string[] } {
  return {
    entries: cache.size,
    keys: Array.from(cache.keys()),
  };
}

export function verifyGithubWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader) return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function getDashboardData(
  options: FetchOptions,
  requestSource: 'request' | 'webhook-preload' = 'request',
): Promise<DashboardPayload> {
  const totalStart = performance.now();
  const selectedDays = normalizeDays(options.days);
  const cacheKey = createCacheKey(options.owner, options.repos, selectedDays);
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    logDashboardTimings(requestSource, {
      totalMs: performance.now() - totalStart,
      resolveReposMs: 0,
      aggregateReposMs: 0,
      assemblePayloadMs: 0,
      repoCount: cached.payload.repos.length,
      cacheStatus: 'hit',
      selectedDays,
    });
    return cached.payload;
  }

  const resolveReposStart = performance.now();
  const repos = await resolveRepos(options.owner, options.token, options.repos);
  const resolveReposMs = performance.now() - resolveReposStart;
  const since = new Date(Date.now() - selectedDays * DAY).toISOString();
  const activityData = createEmptyDailySeries(selectedDays + 1);
  const prData = createEmptyPrSeries(selectedDays);
  const heatmapData = createEmptyHeatmap(Math.max(1, Math.ceil(selectedDays / 7)));

  const dailyIndex = new Map(activityData.map((point, index) => [point.isoDate.slice(0, 10), index]));
  const prIndex = new Map(prData.map((point, index) => [point.isoDate.slice(0, 10), index]));
  const heatmapIndex = new Map(
    heatmapData.flat().map((day, index) => [day.isoDate.slice(0, 10), index]),
  );

  const topRepos: TopRepo[] = [];
  const recentEvents: RecentEvent[] = [];
  const contributorMap = new Map<string, TeamMember>();
  const repoProjectStats: RepoProjectStat[] = [];
  const milestones: Array<{ repo: string; milestone: GithubMilestone }> = [];
  const workCounters = { feature: 0, fix: 0, maintenance: 0 };

  let mergedPrs = 0;
  let openIssues = 0;
  let closedIssues = 0;

  const aggregateReposStart = performance.now();
  const repoAggregates = await Promise.all(
    repos.map((repo) => collectRepoAggregate(options.owner, repo, options.token, since)),
  );
  const aggregateReposMs = performance.now() - aggregateReposStart;

  const assemblePayloadStart = performance.now();
  repoAggregates.forEach((aggregate) => {
    topRepos.push(aggregate.topRepo);
    recentEvents.push(...aggregate.recentEvents);
    repoProjectStats.push(aggregate.repoProjectStat);
    milestones.push(...aggregate.milestones);
    mergedPrs += aggregate.mergedPrs;
    openIssues += aggregate.openIssues;
    closedIssues += aggregate.closedIssues;
    workCounters.feature += aggregate.workCounters.feature;
    workCounters.fix += aggregate.workCounters.fix;
    workCounters.maintenance += aggregate.workCounters.maintenance;

    aggregate.commitBuckets.forEach((count, key) => {
      const activityPos = dailyIndex.get(key);
      if (activityPos !== undefined) {
        activityData[activityPos].commits += count;
      }
    });

    aggregate.prBuckets.forEach((counts, key) => {
      const position = prIndex.get(key);
      if (position !== undefined) {
        prData[position].Merged += counts.merged;
        prData[position].Open += counts.open;
        prData[position].Closed += counts.closed;
      }
    });

    aggregate.heatmapBuckets.forEach((count, key) => {
      const heatmapPos = heatmapIndex.get(key);
      if (heatmapPos !== undefined) {
        const week = Math.floor(heatmapPos / 7);
        const day = heatmapPos % 7;
        heatmapData[week][day].count += count;
      }
    });

    aggregate.contributors.forEach((contributor) => {
      const existing = contributorMap.get(contributor.name);
      if (existing) {
        existing.contributions += contributor.contributions;
      } else {
        contributorMap.set(contributor.name, { ...contributor });
      }
    });
  });

  heatmapData.flat().forEach((day) => {
    day.intensity = scoreIntensity(day.count);
  });

  topRepos.sort((a, b) => b.commits - a.commits);
  recentEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const teamMembers = Array.from(contributorMap.values())
    .sort((a, b) => b.contributions - a.contributions)
    .slice(0, 8);

  const workTotal = workCounters.feature + workCounters.fix + workCounters.maintenance || 1;
  const workDistribution: WorkDistribution[] = [
    {
      name: 'Fitur Baru (New Features)',
      value: Math.round((workCounters.feature / workTotal) * 100),
      color: COLORS.feature,
    },
    {
      name: 'Perbaikan Eror (Bug Fixes)',
      value: Math.round((workCounters.fix / workTotal) * 100),
      color: COLORS.fix,
    },
    {
      name: 'Pemeliharaan (Maintenance)',
      value: Math.max(0, 100 - Math.round((workCounters.feature / workTotal) * 100) - Math.round((workCounters.fix / workTotal) * 100)),
      color: COLORS.maintenance,
    },
  ];

  const nearestMilestoneEntry = milestones
    .sort((a, b) => {
      const aTime = a.milestone.due_on ? new Date(a.milestone.due_on).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.milestone.due_on ? new Date(b.milestone.due_on).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    })[0];

  const currentMilestone: CurrentMilestone = nearestMilestoneEntry
    ? {
        title: nearestMilestoneEntry.milestone.title,
        progress:
          nearestMilestoneEntry.milestone.closed_issues + nearestMilestoneEntry.milestone.open_issues === 0
            ? 0
            : Math.round(
                (nearestMilestoneEntry.milestone.closed_issues /
                  (nearestMilestoneEntry.milestone.closed_issues + nearestMilestoneEntry.milestone.open_issues)) *
                  100,
              ),
        tasksCompleted: nearestMilestoneEntry.milestone.closed_issues,
        tasksTotal:
          nearestMilestoneEntry.milestone.closed_issues + nearestMilestoneEntry.milestone.open_issues,
        dueDate: formatDueDate(nearestMilestoneEntry.milestone.due_on),
        repo: nearestMilestoneEntry.repo,
        url: nearestMilestoneEntry.milestone.html_url,
      }
    : null;

  const payload: DashboardPayload = {
    generatedAt: new Date().toISOString(),
    owner: options.owner,
    selectedDays,
    repos,
    summary: {
      systemUpdates: activityData.reduce((sum, point) => sum + point.commits, 0),
      featuresDelivered: mergedPrs,
      problemsOpen: openIssues,
      problemsClosed: closedIssues,
      activeProjects: repos.length,
    },
    executiveSummary: '',
    activityData,
    prData,
    heatmapData,
    recentEvents: recentEvents.slice(0, 12),
    topRepos: topRepos.slice(0, 6),
    workDistribution,
    teamMembers,
    repoProjectStats,
    currentMilestone,
  };

  payload.executiveSummary = buildExecutiveSummary(payload);
  const assemblePayloadMs = performance.now() - assemblePayloadStart;

  cache.set(cacheKey, {
    expiresAt: Date.now() + DEFAULT_CACHE_TTL_MS,
    payload,
    warmedAt: Date.now(),
    source: requestSource,
  });

  logDashboardTimings(requestSource, {
    totalMs: performance.now() - totalStart,
    resolveReposMs,
    aggregateReposMs,
    assemblePayloadMs,
    repoCount: repos.length,
    cacheStatus: 'miss',
    selectedDays,
  });

  return payload;
}
