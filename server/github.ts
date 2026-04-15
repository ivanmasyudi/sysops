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

type GithubBranch = {
  name: string;
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
  repoBreakdown?: Array<{
    repo: string;
    commits: number;
  }>;
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
  repoBreakdown?: Array<{
    repo: string;
    commits: number;
  }>;
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
  contributors: TeamMember[];
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
  statuses: Array<{
    name: string;
    count: number;
  }>;
  openIssues: number;
  closedIssues: number;
  openPullRequests: number;
  mergedPullRequests: number;
  done: number;
  total: number;
  source?: 'github-project' | 'activity-fallback' | 'unavailable';
  projectTitle?: string | null;
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
  selectedMonth: number;
  selectedYear: number;
  selectedLabel: string;
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
  month: number;
  year: number;
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
  activityRepoBuckets: Map<string, number>;
  prBuckets: Map<string, { merged: number; open: number; closed: number }>;
  heatmapBuckets: Map<string, number>;
  heatmapRepoBuckets: Map<string, number>;
};

type CacheEntry = {
  expiresAt: number;
  payload: DashboardPayload;
  warmedAt: number;
  source: 'request' | 'webhook-preload';
};

type RepoProjectStatSnapshot = Pick<
  RepoProjectStat,
  'statuses' | 'openIssues' | 'closedIssues' | 'openPullRequests' | 'mergedPullRequests' | 'done' | 'total' | 'source' | 'projectTitle'
>;

type RepoProjectStatCacheEntry = {
  expiresAt: number;
  value: RepoProjectStatSnapshot | null;
};

type HeatmapCacheEntry = {
  expiresAt: number;
  data: HeatmapWeek[];
};

type GithubViewer = {
  login: string;
  type: string;
  name?: string | null;
};

type DashboardTimings = {
  totalMs: number;
  resolveReposMs: number;
  aggregateReposMs: number;
  assemblePayloadMs: number;
  repoCount: number;
  cacheStatus: 'hit' | 'miss';
  selectedMonth: number;
  selectedYear: number;
};

type GithubGraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

type GithubProjectItemFieldValue = {
  name?: string | null;
  field?: {
    name?: string | null;
  } | null;
};

type GithubProjectV2Node = {
  title: string;
  fields: {
    nodes: Array<{
      name?: string | null;
      options?: Array<{
        name: string;
      }>;
    }>;
  };
  items: {
    nodes: Array<{
      fieldValues: {
        nodes: GithubProjectItemFieldValue[];
      };
    }>;
  };
};

const GITHUB_API_BASE = 'https://api.github.com';
const DAY = 24 * 60 * 60 * 1000;
const COLORS = {
  feature: '#10b981',
  fix: '#f59e0b',
  maintenance: '#3b82f6',
};

const cache = new Map<string, CacheEntry>();
const repoProjectStatCache = new Map<string, RepoProjectStatCacheEntry>();
const repoProjectStatInFlight = new Map<string, Promise<RepoProjectStatSnapshot | null>>();
const heatmapCache = new Map<string, HeatmapCacheEntry>();
const DEFAULT_CACHE_TTL_MS = 60 * 1000;
const PROJECT_STAT_CACHE_TTL_MS = 5 * 60 * 1000;
const HEATMAP_CACHE_TTL_MS = 15 * 60 * 1000;

function parseGithubLoginList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function getContributorRoleMap(): Map<string, string> {
  const roleMap = new Map<string, string>();
  const roleGroups: Array<[string | undefined, string]> = [
    [process.env.GITHUB_QA_USERS, 'QA'],
    [process.env.GITHUB_FRONTEND_USERS, 'Frontend Engineer'],
    [process.env.GITHUB_BACKEND_USERS, 'Backend Engineer'],
    [process.env.GITHUB_FULLSTACK_USERS, 'Fullstack Engineer'],
    [process.env.GITHUB_DEVOPS_USERS, 'DevOps Engineer'],
    [process.env.GITHUB_PM_USERS, 'Project Manager'],
    [process.env.GITHUB_DESIGN_USERS, 'UI/UX Designer'],
  ];

  roleGroups.forEach(([rawUsers, role]) => {
    parseGithubLoginList(rawUsers).forEach((login) => {
      roleMap.set(login, role);
    });
  });

  const customMappings = (process.env.GITHUB_CONTRIBUTOR_ROLES ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  customMappings.forEach((entry) => {
    const separatorIndex = entry.indexOf(':');
    if (separatorIndex === -1) {
      return;
    }

    const login = entry.slice(0, separatorIndex).trim().toLowerCase();
    const role = entry.slice(separatorIndex + 1).trim();

    if (login && role) {
      roleMap.set(login, role);
    }
  });

  return roleMap;
}

function resolveContributorRole(loginOrName: string, roleMap: Map<string, string>): string {
  return roleMap.get(loginOrName.trim().toLowerCase()) ?? 'Contributor';
}

function createCacheKey(owner: string, repos: string[], month: number, year: number): string {
  return JSON.stringify({
    owner,
    repos: [...repos].sort(),
    month,
    year,
  });
}

function createHeatmapCacheKey(owner: string, repos: string[], year: number): string {
  return JSON.stringify({
    owner,
    repos: [...repos].sort(),
    heatmapYear: year,
  });
}

function logDashboardTimings(label: string, timings: DashboardTimings): void {
  console.log(
    `[dashboard:${label}] cache=${timings.cacheStatus} period=${timings.selectedYear}-${String(timings.selectedMonth).padStart(2, '0')} repos=${timings.repoCount} total=${timings.totalMs.toFixed(0)}ms resolveRepos=${timings.resolveReposMs.toFixed(0)}ms aggregateRepos=${timings.aggregateReposMs.toFixed(0)}ms assemble=${timings.assemblePayloadMs.toFixed(0)}ms`,
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

async function githubRequestPage<T>(
  path: string,
  token: string,
): Promise<{ data: T; linkHeader: string | null }> {
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${response.status}: ${text}`);
  }

  return {
    data: (await response.json()) as T,
    linkHeader: response.headers.get('link'),
  };
}

function getNextPagePath(linkHeader: string | null): string | null {
  if (!linkHeader) {
    return null;
  }

  const nextPart = linkHeader
    .split(',')
    .map((part) => part.trim())
    .find((part) => part.includes('rel="next"'));

  if (!nextPart) {
    return null;
  }

  const match = nextPart.match(/<([^>]+)>/);
  if (!match) {
    return null;
  }

  const nextUrl = new URL(match[1]);
  if (nextUrl.origin !== GITHUB_API_BASE) {
    return null;
  }

  return `${nextUrl.pathname}${nextUrl.search}`;
}

async function githubRequestAllPages<T>(path: string, token: string): Promise<T[]> {
  const items: T[] = [];
  let nextPath = path;

  while (nextPath) {
    const page = await githubRequestPage<T[]>(nextPath, token);
    items.push(...page.data);
    nextPath = getNextPagePath(page.linkHeader);
  }

  return items;
}

async function githubGraphqlRequest<T>(query: string, variables: Record<string, unknown>, token: string): Promise<T> {
  const response = await fetch(`${GITHUB_API_BASE}/graphql`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = (await response.json()) as GithubGraphqlResponse<T>;
  if (!response.ok) {
    throw new Error(`GitHub GraphQL ${response.status}: ${JSON.stringify(payload)}`);
  }

  if (payload.errors?.length) {
    throw new Error(`GitHub GraphQL error: ${payload.errors.map((error) => error.message).join('; ')}`);
  }

  if (!payload.data) {
    throw new Error('GitHub GraphQL error: Missing data');
  }

  return payload.data;
}

async function getAuthenticatedViewer(token: string): Promise<GithubViewer> {
  return githubRequest<GithubViewer>('/user', token);
}

export async function getGithubDebugSnapshot(owner: string, token: string, configuredRepos: string[]) {
  const viewerResponse = await fetch(`${GITHUB_API_BASE}/user`, {
    headers: getAuthHeaders(token),
  });

  const viewerScopes = viewerResponse.headers.get('x-oauth-scopes');
  const acceptedScopes = viewerResponse.headers.get('x-accepted-oauth-scopes');
  let viewer: GithubViewer | null = null;
  let viewerError: string | null = null;

  if (viewerResponse.ok) {
    viewer = (await viewerResponse.json()) as GithubViewer;
  } else {
    viewerError = `GitHub API ${viewerResponse.status}: ${await viewerResponse.text()}`;
  }

  let resolvedRepos: GithubRepo[] = [];
  let resolveError: string | null = null;

  try {
    resolvedRepos = await resolveRepos(owner, token, configuredRepos);
  } catch (error) {
    resolveError = error instanceof Error ? error.message : 'Unknown error';
  }

  const ownerReposResponse = await fetch(`${GITHUB_API_BASE}/users/${owner}/repos?per_page=100&type=owner&sort=updated`, {
    headers: getAuthHeaders(token),
  });
  const ownerReposStatus = ownerReposResponse.status;
  const ownerReposOk = ownerReposResponse.ok;
  let ownerReposCount: number | null = null;
  let ownerReposPreview: string[] = [];
  let ownerReposError: string | null = null;

  if (ownerReposResponse.ok) {
    const ownerRepos = (await ownerReposResponse.json()) as GithubRepo[];
    ownerReposCount = ownerRepos.length;
    ownerReposPreview = ownerRepos.slice(0, 10).map((repo) => repo.name);
  } else {
    ownerReposError = await ownerReposResponse.text();
  }

  const authenticatedUserReposResponse = await fetch(
    `${GITHUB_API_BASE}/user/repos?per_page=100&visibility=all&affiliation=owner&sort=updated`,
    {
      headers: getAuthHeaders(token),
    },
  );
  const authenticatedUserReposStatus = authenticatedUserReposResponse.status;
  const authenticatedUserReposOk = authenticatedUserReposResponse.ok;
  let authenticatedUserReposCount: number | null = null;
  let authenticatedUserReposPreview: string[] = [];
  let authenticatedUserReposError: string | null = null;

  if (authenticatedUserReposResponse.ok) {
    const authenticatedUserRepos = (await authenticatedUserReposResponse.json()) as GithubRepo[];
    authenticatedUserReposCount = authenticatedUserRepos.length;
    authenticatedUserReposPreview = authenticatedUserRepos.slice(0, 10).map((repo) => repo.name);
  } else {
    authenticatedUserReposError = await authenticatedUserReposResponse.text();
  }

  const orgReposResponse = await fetch(`${GITHUB_API_BASE}/orgs/${owner}/repos?per_page=100&type=all&sort=updated`, {
    headers: getAuthHeaders(token),
  });
  const orgReposStatus = orgReposResponse.status;
  const orgReposOk = orgReposResponse.ok;
  let orgReposCount: number | null = null;
  let orgReposPreview: string[] = [];
  let orgReposError: string | null = null;

  if (orgReposResponse.ok) {
    const orgRepos = (await orgReposResponse.json()) as GithubRepo[];
    orgReposCount = orgRepos.length;
    orgReposPreview = orgRepos.slice(0, 10).map((repo) => repo.name);
  } else {
    orgReposError = await orgReposResponse.text();
  }

  return {
    timestamp: new Date().toISOString(),
    owner,
    configuredRepos,
    viewer,
    viewerError,
    tokenScopes: viewerScopes ? viewerScopes.split(',').map((scope) => scope.trim()).filter(Boolean) : [],
    acceptedOauthScopes:
      acceptedScopes ? acceptedScopes.split(',').map((scope) => scope.trim()).filter(Boolean) : [],
    resolveRepos: {
      count: resolvedRepos.length,
      names: resolvedRepos.map((repo) => repo.name),
      error: resolveError,
    },
    ownerReposProbe: {
      endpoint: `/users/${owner}/repos?type=owner`,
      ok: ownerReposOk,
      status: ownerReposStatus,
      count: ownerReposCount,
      names: ownerReposPreview,
      error: ownerReposError,
    },
    authenticatedUserReposProbe: {
      endpoint: '/user/repos?visibility=all&affiliation=owner',
      ok: authenticatedUserReposOk,
      status: authenticatedUserReposStatus,
      count: authenticatedUserReposCount,
      names: authenticatedUserReposPreview,
      error: authenticatedUserReposError,
    },
    orgReposProbe: {
      endpoint: `/orgs/${owner}/repos?type=all`,
      ok: orgReposOk,
      status: orgReposStatus,
      count: orgReposCount,
      names: orgReposPreview,
      error: orgReposError,
    },
  };
}

async function resolveRepos(owner: string, token: string, configuredRepos: string[]): Promise<GithubRepo[]> {
  if (configuredRepos.length > 0) {
    const repos = await Promise.all(
      configuredRepos.map((repo) => githubRequest<GithubRepo>(`/repos/${owner}/${repo}`, token)),
    );
    return repos;
  }

  const viewer = await getAuthenticatedViewer(token).catch(() => null);
  if (viewer?.login?.toLowerCase() === owner.toLowerCase() && viewer.type === 'User') {
    return githubRequest<GithubRepo[]>(
      '/user/repos?per_page=100&visibility=all&affiliation=owner&sort=updated',
      token,
    );
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

function normalizeMonth(month: number): number {
  if (!Number.isFinite(month)) return new Date().getUTCMonth() + 1;
  return Math.min(12, Math.max(1, Math.round(month)));
}

function normalizeYear(year: number): number {
  if (!Number.isFinite(year)) return new Date().getUTCFullYear();
  return Math.min(2100, Math.max(2000, Math.round(year)));
}

function getMonthRange(year: number, month: number): { start: Date; end: Date; dayCount: number } {
  const normalizedYear = normalizeYear(year);
  const normalizedMonth = normalizeMonth(month);
  const start = new Date(Date.UTC(normalizedYear, normalizedMonth - 1, 1));
  const end = new Date(Date.UTC(normalizedYear, normalizedMonth, 0, 23, 59, 59, 999));
  return {
    start,
    end,
    dayCount: end.getUTCDate(),
  };
}

function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
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

function createEmptyDailySeries(start: Date, dayCount: number): DailyPoint[] {
  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY);
    return {
      date: formatLabel(date),
      isoDate: date.toISOString(),
      commits: 0,
    };
  });
}

function createEmptyPrSeries(start: Date, dayCount: number): PullRequestPoint[] {
  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY);
    return {
      date: formatLabel(date),
      isoDate: date.toISOString(),
      Merged: 0,
      Open: 0,
      Closed: 0,
    };
  });
}

function createEmptyHeatmap(start: Date, end: Date): HeatmapWeek[] {
  const startOffset = (start.getUTCDay() + 6) % 7;
  const gridStart = new Date(start.getTime() - startOffset * DAY);
  const endOffset = (7 - ((end.getUTCDay() + 6) % 7) - 1 + 7) % 7;
  const totalDays = Math.round((end.getTime() - gridStart.getTime()) / DAY) + 1 + endOffset;
  const days = Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(gridStart.getTime() + index * DAY);
    return {
      date: formatDateLong(date),
      isoDate: date.toISOString(),
      count: 0,
      intensity: 0,
    };
  });

  const weeksData: HeatmapWeek[] = [];
  const weeks = Math.ceil(totalDays / 7);
  for (let week = 0; week < weeks; week += 1) {
    weeksData.push(days.slice(week * 7, week * 7 + 7));
  }
  return weeksData;
}

function scoreIntensity(count: number): number {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

function isOnOrAfterRange(input: string | null | undefined, rangeStartMs: number): boolean {
  return Boolean(input) && new Date(input as string).getTime() >= rangeStartMs;
}

function isWithinRange(
  input: string | null | undefined,
  rangeStartMs: number,
  rangeEndMs: number,
): boolean {
  if (!input) {
    return false;
  }

  const time = new Date(input).getTime();
  return time >= rangeStartMs && time <= rangeEndMs;
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

async function fetchRepoBranches(owner: string, repo: string, token: string) {
  return githubRequestAllPages<GithubBranch>(`/repos/${owner}/${repo}/branches?per_page=100`, token);
}

async function fetchRepoCommitsForRef(
  owner: string,
  repo: string,
  token: string,
  sinceIso: string,
  untilIso: string,
  refName?: string,
) {
  const refQuery = refName ? `&sha=${encodeURIComponent(refName)}` : '';
  return githubRequestAllPages<GithubCommit>(
    `/repos/${owner}/${repo}/commits?per_page=100&since=${encodeURIComponent(sinceIso)}&until=${encodeURIComponent(untilIso)}${refQuery}`,
    token,
  );
}

async function fetchRepoCommits(owner: string, repo: string, token: string, sinceIso: string, untilIso: string) {
  try {
    const branches = await fetchRepoBranches(owner, repo, token).catch(() => []);
    const refs = branches.length > 0 ? Array.from(new Set(branches.map((branch) => branch.name))) : [undefined];
    const uniqueCommits = new Map<string, GithubCommit>();

    for (const refName of refs) {
      const branchCommits = await fetchRepoCommitsForRef(owner, repo, token, sinceIso, untilIso, refName);
      branchCommits.forEach((commit) => {
        uniqueCommits.set(commit.sha, commit);
      });
    }

    return [...uniqueCommits.values()];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Git Repository is empty')) {
      return [];
    }

    throw error;
  }
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

function isDoneLikeStatus(statusName: string): boolean {
  return ['done', 'complete', 'completed', 'closed'].includes(statusName.trim().toLowerCase());
}

async function fetchRepoProjectStat(
  owner: string,
  repo: string,
  token: string,
): Promise<RepoProjectStatSnapshot | null> {
  const data = await githubGraphqlRequest<{
    repository: {
      projectsV2: {
        nodes: GithubProjectV2Node[];
      };
    } | null;
  }>(
    `
      query RepoProjects($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          projectsV2(first: 20, orderBy: { field: UPDATED_AT, direction: DESC }) {
            nodes {
              title
              fields(first: 20) {
                nodes {
                  ... on ProjectV2SingleSelectField {
                    name
                    options {
                      name
                    }
                  }
                }
              }
              items(first: 100) {
                nodes {
                  fieldValues(first: 20) {
                    nodes {
                      ... on ProjectV2ItemFieldSingleSelectValue {
                        name
                        field {
                          ... on ProjectV2Field {
                            name
                          }
                          ... on ProjectV2SingleSelectField {
                            name
                          }
                          ... on ProjectV2IterationField {
                            name
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    { owner, repo },
    token,
  );

  const projects = data.repository?.projectsV2.nodes ?? [];
  if (projects.length === 0) {
    return null;
  }

  const matchingProject =
    projects.find((project) => project.title.trim().toLowerCase() === repo.trim().toLowerCase()) ?? projects[0];

  const statusField = matchingProject.fields.nodes.find((field) => field.name === 'Status');
  const orderedStatuses = (statusField?.options ?? []).map((option) => ({
    name: option.name,
    count: 0,
  }));
  const statusMap = new Map(orderedStatuses.map((status) => [status.name, status]));

  matchingProject.items.nodes.forEach((item) => {
    const statusValue = item.fieldValues.nodes.find(
      (fieldValue) => fieldValue.field?.name === 'Status' && fieldValue.name,
    );
    if (!statusValue?.name) {
      return;
    }

    const existingStatus = statusMap.get(statusValue.name);
    if (existingStatus) {
      existingStatus.count += 1;
      return;
    }

    const dynamicStatus = { name: statusValue.name, count: 1 };
    orderedStatuses.push(dynamicStatus);
    statusMap.set(statusValue.name, dynamicStatus);
  });

  const statuses = orderedStatuses.filter((status) => status.count > 0 || orderedStatuses.length <= 6);

  return {
    statuses,
    openIssues: 0,
    closedIssues: 0,
    openPullRequests: 0,
    mergedPullRequests: 0,
    done: statuses
      .filter((status) => isDoneLikeStatus(status.name))
      .reduce((sum, status) => sum + status.count, 0),
    total: statuses.reduce((sum, status) => sum + status.count, 0),
    source: 'github-project',
    projectTitle: matchingProject.title,
  };
}

async function fetchRepoProjectStatCached(
  owner: string,
  repo: string,
  token: string,
): Promise<RepoProjectStatSnapshot | null> {
  const cacheKey = `${owner}/${repo}`;
  const cached = repoProjectStatCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const inFlight = repoProjectStatInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const request = (async () => {
    try {
      const value = await fetchRepoProjectStat(owner, repo, token);
      repoProjectStatCache.set(cacheKey, {
        value,
        expiresAt: Date.now() + PROJECT_STAT_CACHE_TTL_MS,
      });
      return value;
    } catch (error) {
      if (cached) {
        console.warn(
          `[dashboard:repo-project-cache] using stale project stat for ${cacheKey} because refresh failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return cached.value;
      }

      console.warn(
        `[dashboard:repo-project-cache] project stat unavailable for ${cacheKey}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return {
        statuses: [],
        openIssues: 0,
        closedIssues: 0,
        openPullRequests: 0,
        mergedPullRequests: 0,
        done: 0,
        total: 0,
        source: 'unavailable',
        projectTitle: null,
      } satisfies RepoProjectStatSnapshot;
    } finally {
      repoProjectStatInFlight.delete(cacheKey);
    }
  })();

  repoProjectStatInFlight.set(cacheKey, request);
  return request;
}

function cloneHeatmapData(heatmapData: HeatmapWeek[]): HeatmapWeek[] {
  return heatmapData.map((week) =>
    week.map((day) => ({
      ...day,
      repoBreakdown: day.repoBreakdown?.map((item) => ({ ...item })),
    })),
  );
}

async function getYearHeatmapData(
  owner: string,
  repos: GithubRepo[],
  token: string,
  year: number,
): Promise<HeatmapWeek[]> {
  const cacheKey = createHeatmapCacheKey(owner, repos.map((repo) => repo.name), year);
  const cached = heatmapCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cloneHeatmapData(cached.data);
  }

  const yearStart = getMonthRange(year, 1).start;
  const yearEnd = getMonthRange(year, 12).end;
  const heatmapData = createEmptyHeatmap(yearStart, yearEnd);
  const heatmapIndex = new Map(
    heatmapData.flat().map((day, index) => [day.isoDate.slice(0, 10), index]),
  );

  const repoCommitSets = await Promise.all(
    repos.map(async (repo) => ({
      repo: repo.name,
      commits: await fetchRepoCommits(owner, repo.name, token, yearStart.toISOString(), yearEnd.toISOString()),
    })),
  );

  repoCommitSets.forEach(({ repo, commits }) => {
    commits.forEach((commit) => {
      const dateKey = commit.commit.author.date.slice(0, 10);
      const heatmapPos = heatmapIndex.get(dateKey);
      if (heatmapPos === undefined) {
        return;
      }

      const week = Math.floor(heatmapPos / 7);
      const day = heatmapPos % 7;
      heatmapData[week][day].count += 1;

      const existingBreakdown = heatmapData[week][day].repoBreakdown ?? [];
      const existingRepo = existingBreakdown.find((item) => item.repo === repo);
      if (existingRepo) {
        existingRepo.commits += 1;
      } else {
        existingBreakdown.push({
          repo,
          commits: 1,
        });
      }
      heatmapData[week][day].repoBreakdown = existingBreakdown.sort((a, b) => b.commits - a.commits);
    });
  });

  heatmapData.flat().forEach((day) => {
    day.intensity = scoreIntensity(day.count);
  });

  heatmapCache.set(cacheKey, {
    data: cloneHeatmapData(heatmapData),
    expiresAt: Date.now() + HEATMAP_CACHE_TTL_MS,
  });

  return heatmapData;
}

async function collectRepoAggregate(
  owner: string,
  repo: GithubRepo,
  token: string,
  since: string,
  until: string,
): Promise<RepoAggregate> {
  const contributorRoleMap = getContributorRoleMap();
  const githubProjectStat = await fetchRepoProjectStatCached(owner, repo.name, token);
  const [commits, pulls, issues, repoMilestones] = await Promise.all([
    fetchRepoCommits(owner, repo.name, token, since, until),
    fetchRepoPulls(owner, repo.name, token),
    fetchRepoIssues(owner, repo.name, token),
    fetchRepoMilestones(owner, repo.name, token).catch(() => []),
  ]);

  const rangeStartMs = new Date(since).getTime();
  const rangeEndMs = new Date(until).getTime();
  const recentEvents: RecentEvent[] = [];
  const contributors = new Map<string, TeamMember>();
  const commitBuckets = new Map<string, number>();
  const activityRepoBuckets = new Map<string, number>();
  const prBuckets = new Map<string, { merged: number; open: number; closed: number }>();
  const heatmapBuckets = new Map<string, number>();
  const heatmapRepoBuckets = new Map<string, number>();
  const workCounters = { feature: 0, fix: 0, maintenance: 0 };

  let mergedPrs = 0;
  let openIssues = 0;
  let closedIssues = 0;

  commits.forEach((commit) => {
    const key = commit.commit.author.date.slice(0, 10);
    commitBuckets.set(key, (commitBuckets.get(key) ?? 0) + 1);
    heatmapBuckets.set(key, (heatmapBuckets.get(key) ?? 0) + 1);
    const repoKey = `${key}::${repo.name}`;
    activityRepoBuckets.set(repoKey, (activityRepoBuckets.get(repoKey) ?? 0) + 1);
    heatmapRepoBuckets.set(repoKey, (heatmapRepoBuckets.get(repoKey) ?? 0) + 1);

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
        role: resolveContributorRole(contributorKey, contributorRoleMap),
        avatar:
          commit.author?.avatar_url ??
          `https://ui-avatars.com/api/?name=${encodeURIComponent(contributorKey)}&background=0f172a&color=ffffff`,
        profileUrl: commit.author?.html_url ?? '#',
        contributions: 1,
      });
    }
  });

  pulls.forEach((pull) => {
    if (isWithinRange(pull.created_at, rangeStartMs, rangeEndMs)) {
      const createdKey = pull.created_at.slice(0, 10);
      const bucket = prBuckets.get(createdKey) ?? { merged: 0, open: 0, closed: 0 };
      bucket.open += 1;
      prBuckets.set(createdKey, bucket);
    }

    if (isWithinRange(pull.closed_at, rangeStartMs, rangeEndMs) && pull.closed_at) {
      const closedKey = pull.closed_at.slice(0, 10);
      const closedBucket = prBuckets.get(closedKey) ?? { merged: 0, open: 0, closed: 0 };
      closedBucket.closed += 1;
      prBuckets.set(closedKey, closedBucket);
    }

    if (isWithinRange(pull.merged_at, rangeStartMs, rangeEndMs) && pull.merged_at) {
      const mergedKey = pull.merged_at.slice(0, 10);
      const mergedBucket = prBuckets.get(mergedKey) ?? { merged: 0, open: 0, closed: 0 };
      mergedBucket.merged += 1;
      prBuckets.set(mergedKey, mergedBucket);
      mergedPrs += 1;
    }

    if (isWithinRange(pull.updated_at, rangeStartMs, rangeEndMs)) {
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
    }
  });

  const filteredIssues = issues.filter((issue) => !issue.pull_request);

  filteredIssues.forEach((issue) => {
    if (issue.state === 'open') {
      openIssues += 1;
    }

    if (isWithinRange(issue.closed_at, rangeStartMs, rangeEndMs)) {
      closedIssues += 1;
    }

    if (isWithinRange(issue.updated_at, rangeStartMs, rangeEndMs)) {
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
    }
  });

  const done = pulls.filter((pull) => isWithinRange(pull.merged_at, rangeStartMs, rangeEndMs)).length;
  const inProgress = pulls.filter(
    (pull) => pull.state === 'open' && isWithinRange(pull.updated_at, rangeStartMs, rangeEndMs),
  ).length;
  const todo = filteredIssues.filter(
    (issue) => issue.state === 'open' && isWithinRange(issue.updated_at, rangeStartMs, rangeEndMs),
  ).length;
  const sortedContributors = Array.from(contributors.values()).sort((a, b) => b.contributions - a.contributions);
  const fallbackRepoProjectStat: RepoProjectStat = {
    name: repo.name,
    statuses: [
      { name: 'Done', count: done },
      { name: 'In Progress', count: inProgress },
      { name: 'To Do', count: todo },
    ],
    openIssues,
    closedIssues,
    openPullRequests: inProgress,
    mergedPullRequests: mergedPrs,
    done,
    total: todo + inProgress + done,
    source: 'activity-fallback',
    projectTitle: null,
  };

  const unavailableRepoProjectStat: RepoProjectStat = {
    name: repo.name,
    statuses: [],
    openIssues: 0,
    closedIssues: 0,
    openPullRequests: 0,
    mergedPullRequests: 0,
    done: 0,
    total: 0,
    source: 'unavailable',
    projectTitle: null,
  };

  return {
    topRepo: {
      name: repo.name,
      commits: commits.length,
      language: repo.language ?? 'Unknown',
      contributors: sortedContributors.slice(0, 4),
    },
    recentEvents,
    contributors: sortedContributors,
    repoProjectStat:
      githubProjectStat?.source === 'github-project'
        ? {
          name: repo.name,
          ...githubProjectStat,
          openIssues,
          closedIssues,
          openPullRequests: inProgress,
          mergedPullRequests: mergedPrs,
        }
        : githubProjectStat?.source === 'unavailable'
          ? unavailableRepoProjectStat
          : fallbackRepoProjectStat,
    milestones: repoMilestones.map((milestone) => ({ repo: repo.name, milestone })),
    workCounters,
    mergedPrs,
    openIssues,
    closedIssues,
    commitBuckets,
    activityRepoBuckets,
    prBuckets,
    heatmapBuckets,
    heatmapRepoBuckets,
  };
}

function buildExecutiveSummary(payload: DashboardPayload): string {
  const topRepo = payload.topRepos[0];
  const milestone = payload.currentMilestone;
  const rangeLabel = payload.selectedLabel;
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
  repoProjectStatCache.clear();
  repoProjectStatInFlight.clear();
  heatmapCache.clear();
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

function mergeRepoProjectStatsWithPrevious(
  current: RepoProjectStat[],
  previous?: DashboardPayload,
): RepoProjectStat[] {
  if (!previous) {
    return current;
  }

  const previousByRepo = new Map(previous.repoProjectStats.map((item) => [item.name, item]));

  return current.map((item) => {
    if (item.source === 'github-project') {
      return item;
    }

    const previousItem = previousByRepo.get(item.name);
    if (!previousItem || previousItem.source !== 'github-project') {
      return item;
    }

    return {
      ...previousItem,
      openIssues: item.openIssues,
      closedIssues: item.closedIssues,
      openPullRequests: item.openPullRequests,
      mergedPullRequests: item.mergedPullRequests,
    };
  });
}

export async function getDashboardData(
  options: FetchOptions,
  requestSource: 'request' | 'webhook-preload' = 'request',
): Promise<DashboardPayload> {
  const totalStart = performance.now();
  const selectedMonth = normalizeMonth(options.month);
  const selectedYear = normalizeYear(options.year);
  const cacheKey = createCacheKey(options.owner, options.repos, selectedMonth, selectedYear);
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    logDashboardTimings(requestSource, {
      totalMs: performance.now() - totalStart,
      resolveReposMs: 0,
      aggregateReposMs: 0,
      assemblePayloadMs: 0,
      repoCount: cached.payload.repos.length,
      cacheStatus: 'hit',
      selectedMonth,
      selectedYear,
    });
    return cached.payload;
  }

  const resolveReposStart = performance.now();
  const repos = await resolveRepos(options.owner, options.token, options.repos);
  const resolveReposMs = performance.now() - resolveReposStart;
  const monthRange = getMonthRange(selectedYear, selectedMonth);
  const since = monthRange.start.toISOString();
  const until = monthRange.end.toISOString();
  const activityData = createEmptyDailySeries(monthRange.start, monthRange.dayCount);
  const prData = createEmptyPrSeries(monthRange.start, monthRange.dayCount);
  const heatmapData = await getYearHeatmapData(options.owner, repos, options.token, selectedYear);

  const dailyIndex = new Map(activityData.map((point, index) => [point.isoDate.slice(0, 10), index]));
  const prIndex = new Map(prData.map((point, index) => [point.isoDate.slice(0, 10), index]));

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
    repos.map((repo) => collectRepoAggregate(options.owner, repo, options.token, since, until)),
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

    aggregate.activityRepoBuckets.forEach((count, key) => {
      const separatorIndex = key.indexOf('::');
      if (separatorIndex === -1) {
        return;
      }

      const dateKey = key.slice(0, separatorIndex);
      const repoName = key.slice(separatorIndex + 2);
      const activityPos = dailyIndex.get(dateKey);
      if (activityPos === undefined) {
        return;
      }

      const existingBreakdown = activityData[activityPos].repoBreakdown ?? [];
      const existingRepo = existingBreakdown.find((item) => item.repo === repoName);
      if (existingRepo) {
        existingRepo.commits += count;
      } else {
        existingBreakdown.push({
          repo: repoName,
          commits: count,
        });
      }
      activityData[activityPos].repoBreakdown = existingBreakdown.sort((a, b) => b.commits - a.commits);
    });

    aggregate.prBuckets.forEach((counts, key) => {
      const position = prIndex.get(key);
      if (position !== undefined) {
        prData[position].Merged += counts.merged;
        prData[position].Open += counts.open;
        prData[position].Closed += counts.closed;
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

  const mergedRepoProjectStats = mergeRepoProjectStatsWithPrevious(repoProjectStats, cached?.payload);

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
    selectedMonth,
    selectedYear,
    selectedLabel: formatMonthLabel(monthRange.start),
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
    repoProjectStats: mergedRepoProjectStats,
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
    selectedMonth,
    selectedYear,
  });

  return payload;
}
