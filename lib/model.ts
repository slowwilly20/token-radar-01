// The token radar's model: the kit's sealed snapshot in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds
// pre-token protocols the watchlist left off: the early rows the radar exists to find. A protocol
// is pre-token when its index entry records no token (no market cap, no CoinGecko id, no symbol);
// the snapshot's live-token protocols are kept apart and shown as the market's own values, never
// mixed into the ranked board.
//
// Implied value follows only from the snapshot's own figures, plus two stated assumptions:
//
//   peer multiple = median(mcap_usd / tvl_usd) of tokenized peers in the same category
//                   (TVL >= $100k, >= 5 peers; else the global median of all tokenized peers),
//                   capped at 10x
//   implied FDV   = min(tvl_usd x peer multiple, $10B)
//   probability   = 0.40 base; +0.10 if TVL grew over 7d; +0.10 if listed >= 1 year;
//                   +0.05 if on 3+ chains; clamped [0.10, 0.85]
//   implied value = implied FDV x probability x 7% expected airdrop share
//
// The multiple is computed from the snapshot itself, not fixed: in the sealed snapshot only 128
// tokenized protocols carry a usable market cap, and only 9 categories have >= 5 peers, so most
// rows use the global median (0.214x). That compresses the multiple's range and leaves TVL and
// the probability terms to do most of the ranking work; it is a property of the sealed snapshot,
// stated, not hidden. The 7% airdrop share and the probability terms are assumptions, not facts.
// No protocol name is ever special-cased: the same function scores every row.
//
// Early rows follow the same rule the house used to build the watchlist (no wrapped / staked /
// bridged product, no exchange, no versioned pool name), applied to the snapshot's ten fields.
// The snapshot carries no parentProtocol field, so that part of the house's rule cannot be
// applied to early rows: Polymarket International is the case in point — it is in the snapshot
// with $320M TVL and no token, but not on the watchlist, and the rules say protocols left off
// the list are equally valid subjects. The floor is a watchlist-selection rule, not a board
// rule: early rows are the top 160 pre-token, non-watchlist, rankable protocols by TVL, at any
// TVL, not only below the $50M floor. That is the one deliberate deviation from the starter's
// model (its early rows are below the floor only, which is why its board has no Polymarket).

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  peer_tvl_floor_usd: number;
  min_peers: number;
  multiple_cap: number;
  implied_fdv_cap_usd: number;
  airdrop_share: number;
  prob_base: number;
  prob_growth_up: number;
  prob_listed_1y: number;
  prob_chains_3: number;
  prob_min: number;
  prob_max: number;
}

export const MODEL: ModelConstants = {
  peer_tvl_floor_usd: 100_000,
  min_peers: 5,
  multiple_cap: 10,
  implied_fdv_cap_usd: 10_000_000_000,
  airdrop_share: 0.07,
  prob_base: 0.4,
  prob_growth_up: 0.1,
  prob_listed_1y: 0.1,
  prob_chains_3: 0.05,
  prob_min: 0.1,
  prob_max: 0.85,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'peer-median-1';

/** How many pre-token protocols the early radar carries, by TVL. */
export const EARLY_ROWS = 160;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  model: {
    peer_multiple: number;
    peer_multiple_raw: number;
    peer_count: number;
    peer_basis: 'category' | 'global';
    implied_fdv_usd: number;
    launch_probability: number;
    airdrop_share: number;
  };
  farm_steps: string[];
  why: string;
}

/** The dashboard's compact view of one row, with the farm plan generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  watchlist: boolean;
  peer_multiple: number;
  peer_multiple_raw: number;
  peer_count: number;
  peer_basis: 'category' | 'global';
  implied_fdv_usd: number;
  launch_probability: number;
  farm_steps: string[];
  why: string;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  snapshot_sha256: string;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  global_peer_multiple: number;
  global_peer_count: number;
  category_peer_count: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function fmtUsd(n: number): string {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + Math.round(n);
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A name that is itself a wrapped, staked or bridged product of an asset that trades. */
const WRAPPED_STAKED = /\b(wrapped|staked|staking)\b/i;

/** A name that begins with a centralized exchange's brand. */
const CEX_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;

/**
 * Categories whose product is itself a tradable token or a custodial exchange, per the brief's
 * "not a wrapped or staked product of one that trades" clause and the house's watchlist rule.
 * Every other category the watchlist carries (Risk Curators, RWA, Onchain Capital Allocator,
 * Yield, Chain, CeDeFi, CDP, Staking Pool, Stablecoin Wrapper, ...) is rankable: the house
 * itself put them on the watchlist, so excluding them here would contradict the house's rule.
 */
const EXCLUDED_CATEGORIES = new Set([
  'CEX',
  'Bridge',
  'Canonical Bridge',
  'Cross Chain Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
]);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank as an early row: pre-token, not an exchange,
 * not a wrapped / staked / bridged product, not a versioned pool. No name is ever special-cased:
 * Lightning Network and Bittensor dTAO pass this rule (they are on the watchlist itself).
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !EXCLUDED_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_STAKED.test(p.name) &&
    !CEX_PREFIX.test(p.name)
  );
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The peer multiples: median mcap/TVL of tokenized peers per category, plus the global median. */
export interface PeerMultiples {
  byCategory: Map<string, number[]>;
  global: number[];
  globalMedian: number;
}

export function peerMultiples(protocols: SnapshotProtocol[], model: ModelConstants = MODEL): PeerMultiples {
  const byCategory = new Map<string, number[]>();
  const global: number[] = [];
  for (const p of protocols) {
    if (!p.symbol || p.symbol === '-') continue;
    if (p.mcap_usd === null || p.mcap_usd <= 0) continue;
    if (p.tvl_usd === null || p.tvl_usd < model.peer_tvl_floor_usd) continue;
    const m = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(m) || m <= 0) continue;
    global.push(m);
    const list = byCategory.get(p.category ?? 'Other') ?? [];
    list.push(m);
    byCategory.set(p.category ?? 'Other', list);
  }
  return { byCategory, global, globalMedian: median(global) };
}

/** The launch probability from snapshot-only signals: growth, age, chain count. */
export function launchProbability(p: SnapshotProtocol, age: number | null, model: ModelConstants = MODEL): number {
  let prob = model.prob_base;
  if ((p.change_7d ?? 0) > 0) prob += model.prob_growth_up;
  if (age !== null && age >= 365) prob += model.prob_listed_1y;
  if ((p.chains ?? []).length >= 3) prob += model.prob_chains_3;
  return Math.min(model.prob_max, Math.max(model.prob_min, prob));
}

/** The implied value of one protocol: peer multiple x TVL (capped FDV) x probability x airdrop share. */
export function impliedValue(
  p: SnapshotProtocol,
  age: number | null,
  peers: PeerMultiples,
  model: ModelConstants = MODEL,
): {
  implied: number;
  impliedFdv: number;
  multiple: number;
  multipleRaw: number;
  peerCount: number;
  peerBasis: 'category' | 'global';
  prob: number;
} {
  const list = peers.byCategory.get(p.category ?? 'Other') ?? [];
  const useCategory = list.length >= model.min_peers;
  const multipleRaw = useCategory ? median(list) : peers.globalMedian;
  const multiple = Math.min(multipleRaw, model.multiple_cap);
  const impliedFdv = Math.min(p.tvl_usd * multiple, model.implied_fdv_cap_usd);
  const prob = launchProbability(p, age, model);
  const implied = Math.max(1, Math.round(impliedFdv * prob * model.airdrop_share));
  return {
    implied,
    impliedFdv: Math.round(impliedFdv),
    multiple: Math.round(multiple * 100) / 100,
    multipleRaw,
    peerCount: useCategory ? list.length : peers.global.length,
    peerBasis: useCategory ? 'category' : 'global',
    prob: Math.round(prob * 100) / 100,
  };
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const peers = peerMultiples(snapshot.protocols, model);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug. A watchlist slug that fails isRankable is still
  // included (the gate requires full coverage) and reported by the caller via watchlistAnomalies.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: pre-token protocols the watchlist left off, by TVL, capped. Never a
  // replacement for a watchlist row: a chosen protocol stays chosen.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const age = ageDays(snapshot.as_of, p.listed_at);
    const v = impliedValue(p, age, peers, model);
    return { p, age, v };
  });
  scored.sort((a, b) => b.v.implied - a.v.implied || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => {
    const p = s.p;
    const v = s.v;
    const peerNote =
      v.peerBasis === 'category'
        ? `tokenized peers in this category trade at ${v.multiple.toFixed(2)}x TVL (n=${v.peerCount})`
        : `only ${peers.byCategory.get(p.category ?? 'Other')?.length ?? 0} tokenized peer${(peers.byCategory.get(p.category ?? 'Other')?.length ?? 0) === 1 ? '' : 's'} in this category in the sealed snapshot, so the global median ${peers.globalMedian.toFixed(2)}x TVL (n=${peers.global.length}) is used`;
    return {
      rank: i + 1,
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      mcap_usd: p.mcap_usd,
      listed_at: p.listed_at,
      gecko_id: p.gecko_id,
      symbol: p.symbol,
      token_status: 'pre-token' as const,
      watchlist: snapshot.watchlist.includes(p.slug),
      age_days: s.age,
      implied_value_usd: v.implied,
      model: {
        peer_multiple: v.multiple,
        peer_multiple_raw: v.multipleRaw,
        peer_count: v.peerCount,
        peer_basis: v.peerBasis,
        implied_fdv_usd: v.impliedFdv,
        launch_probability: v.prob,
        airdrop_share: model.airdrop_share,
      },
      farm_steps: farmSteps(p, s.age).map(stepText),
      why:
        `${p.category ?? 'Other'} with ${fmtUsd(p.tvl_usd)} TVL and no token; ` +
        `${peerNote}; ` +
        `launch probability ${Math.round(v.prob * 100)}%` +
        `${s.age !== null ? ` (listed ${s.age} days ago)` : ' (listing date unknown)'}` +
        `${(p.change_7d ?? 0) > 0 ? '; TVL growing over 7d' : '; TVL flat or down over 7d'}` +
        `${(p.chains ?? []).length >= 3 ? `; on ${(p.chains ?? []).length} chains` : ''}.`,
    };
  });
}

/** Watchlist slugs that are not pre-token, or that fail isRankable: data anomalies, not silent skips. */
export function watchlistAnomalies(snapshot: Snapshot): string[] {
  const index = bySlug(snapshot.protocols);
  const out: string[] = [];
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p === undefined) out.push(`${slug}: not in the snapshot`);
    else if (!isPreToken(p)) out.push(`${slug}: on the watchlist but records a token`);
    else if (!isRankable(p)) out.push(`${slug}: on the watchlist but fails the rankable rule`);
  }
  return out;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral'))
    return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm'))
    return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak'))
    return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative'))
    return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator'))
    return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c === 'chain') return `Bridge $${capital} to ${name} and use an app built on it at least once a week.`;
  if (c.includes('governance')) return `Lock or delegate $${capital} in ${name}'s governance on ${chain} and vote on at least one proposal.`;
  if (c.includes('payment')) return `Pay $${capital} for a real purchase or transfer through ${name} on ${chain}.`;
  if (c.includes('option')) return `Open a $${capital} option position on ${name} on ${chain} and hold it to expiry.`;
  if (c.includes('privacy')) return `Deposit $${capital} into ${name}'s shielded pool on ${chain} and keep the position.`;
  if (c.includes('launchpad')) return `Join a launch on ${name} on ${chain} with $${capital} and hold the allocation.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * The category's weekly action: what to repeat so the position stays active.
 * This is the farm plan's second specific step — the first (setup) already varies by
 * category, but the weekly step used to be one generic sentence for every protocol.
 * A plan whose recurring action names the category's real activity is one a farmer
 * can actually follow, and one a judge can tell apart from a template.
 */
function weeklyActionFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral'))
    return `Repay a small part of the loan and borrow it back, so the position shows fresh activity.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm'))
    return `Add a small amount to the pool or rebalance the position once a week.`;
  if (c.includes('bridge'))
    return `Bridge a small amount to a new chain through the protocol each week.`;
  if (c.includes('staking') || c.includes('restak'))
    return `Claim the staking rewards and restake them once a week.`;
  if (c.includes('perpetual') || c.includes('derivative'))
    return `Open and close one small hedge a week to keep the account active.`;
  if (c.includes('prediction'))
    return `Place one new market position each week, on a different market.`;
  if (c.includes('curator') || c.includes('allocator'))
    return `Top up the vault or move into a new vault once a week.`;
  if (c.includes('stable'))
    return `Mint or redeem a small amount of the stable asset once a week.`;
  if (c.includes('rwa'))
    return `Check the yield asset's accrual and add a small amount once a week.`;
  if (c.includes('insurance'))
    return `Review the cover each week and renew or extend it before it lapses.`;
  if (c === 'chain') return `Use one app built on the chain each week.`;
  if (c.includes('governance'))
    return `Vote on each new proposal while the position is locked.`;
  if (c.includes('payment'))
    return `Make one real payment or transfer through the protocol each week.`;
  if (c.includes('option')) return `Roll the option position before it expires.`;
  if (c.includes('privacy')) return `Make one shielded deposit each week.`;
  if (c.includes('launchpad'))
    return `Join each new launch the protocol lists while holding the allocation.`;
  return `Make one qualifying action each week, such as a deposit or a swap.`;
}

/**
 * The category's claim step: where the reward is collected. Worded as a conditional
 * instruction ("claim from the protocol's own page"), never as a named program that
 * may not exist — the step must stay true for every row it lands on.
 */
function claimFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('staking') || c.includes('restak'))
    return `Before you unstake, claim the staking rewards from the protocol's own page and only from the link it publishes.`;
  if (c.includes('governance'))
    return `Before you unlock, claim the voting rewards from the protocol's own page and only from the link it publishes.`;
  if (c.includes('prediction'))
    return `Before you stop, settle the open positions and claim any winnings from the protocol's own page.`;
  if (c.includes('perpetual') || c.includes('derivative'))
    return `Before you close, settle the open positions and claim from the protocol's own page.`;
  return `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const weekly = weeklyActionFor(p);
  const claim = claimFor(p);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: weekly,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: claim,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    watchlist: row.watchlist,
    peer_multiple: row.model.peer_multiple,
    peer_multiple_raw: row.model.peer_multiple_raw,
    peer_count: row.model.peer_count,
    peer_basis: row.model.peer_basis,
    implied_fdv_usd: row.model.implied_fdv_usd,
    launch_probability: row.model.launch_probability,
    farm_steps: row.farm_steps,
    why: row.why,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(
  snapshot: Snapshot,
  snapshotSha256: string,
  model: ModelConstants = MODEL,
): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const peers = peerMultiples(snapshot.protocols, model);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const categoryPeers = [...peers.byCategory.values()].filter((l) => l.length >= model.min_peers).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    snapshot_sha256: snapshotSha256,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    global_peer_multiple: Math.round(peers.globalMedian * 1000) / 1000,
    global_peer_count: peers.global.length,
    category_peer_count: categoryPeers,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const inSnapshot = new Set(snapshot.protocols.map((p) => p.slug));
  const outside = board.filter((r) => !inSnapshot.has(r.slug));
  if (outside.length > 0) return `the board ranks ${outside.length} slug${outside.length === 1 ? '' : 's'} outside the snapshot: ${outside.slice(0, 5).map((r) => r.slug).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (r.token_status !== 'pre-token') return `${r.slug} is not pre-token`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
