import { IPL_PLAYERS } from '../data/players';

/**
 * Auction bot valuation engine.
 *
 * Squad-fit is progressive:
 * - Small squads: player quality and value matter most.
 * - Mid-sized squads: bots begin filling missing roles.
 * - Large squads: role balance and depth matter more.
 *
 * Squad fit is a soft preference, never a role-based hard restriction.
 */

const SET_TIER = {
  'Marquee Set 1': { base: 2.2, max: 4.5 },
  'Set 1': { base: 1.5, max: 3.0 },
  'Set 2': { base: 1.2, max: 2.2 },
  'Set 3': { base: 1.0, max: 1.7 },
  'Set 4': { base: 0.8, max: 1.4 },
  AL1: { base: 1.3, max: 2.5 },
  WK1: { base: 1.3, max: 2.4 },
  FA1: { base: 1.2, max: 2.2 },
  UBA1: { base: 0.9, max: 1.5 },
  UAL1: { base: 0.9, max: 1.6 },
  UWK1: { base: 0.8, max: 1.4 },
  UFA1: { base: 0.8, max: 1.3 },
  USP1: { base: 0.7, max: 1.2 },
  BA2: { base: 0.7, max: 1.2 },
  AL2: { base: 0.7, max: 1.2 },
  WK2: { base: 0.7, max: 1.1 },
  FA2: { base: 0.7, max: 1.1 },
  SP2: { base: 0.6, max: 1.0 },
  UBA2: { base: 0.6, max: 1.0 },
  UAL2: { base: 0.6, max: 1.0 },
  UWK2: { base: 0.5, max: 0.9 },
  UFA2: { base: 0.5, max: 0.9 },
};

const TEAM_PREFERENCES = {
  CSK: {
    roles: { 'All-Rounder': 1.4, Bowler: 1.25 },
    sets: { 'Marquee Set 1': 1.2 },
    personality: 'conservative',
  },
  MI: {
    roles: { Bowler: 1.35, Batsman: 1.2 },
    sets: { 'Marquee Set 1': 1.3, 'Set 1': 1.15 },
    personality: 'aggressive',
  },
  RCB: {
    roles: { Batsman: 1.45, 'All-Rounder': 1.2 },
    sets: { 'Marquee Set 1': 1.35, AL1: 1.2 },
    personality: 'aggressive',
  },
  KKR: {
    roles: { Bowler: 1.3, 'All-Rounder': 1.25 },
    sets: { 'Set 1': 1.15 },
    personality: 'balanced',
  },
  DC: {
    roles: { Bowler: 1.3, Wicketkeeper: 1.25 },
    sets: { UFA1: 1.2, UBA1: 1.15 },
    personality: 'value',
  },
  PBKS: {
    roles: { Batsman: 1.25, 'All-Rounder': 1.15 },
    sets: { UBA1: 1.3, UAL1: 1.25 },
    personality: 'value',
  },
  RR: {
    roles: { 'All-Rounder': 1.35, Bowler: 1.2 },
    sets: { UBA1: 1.3, UAL1: 1.25, UFA1: 1.2 },
    personality: 'value',
  },
  SRH: {
    roles: { Bowler: 1.4, Batsman: 1.25 },
    sets: { FA1: 1.25, 'Set 1': 1.15 },
    personality: 'balanced',
  },
  GT: {
    roles: { 'All-Rounder': 1.3, Bowler: 1.2 },
    sets: { 'Set 2': 1.15, 'Set 3': 1.1 },
    personality: 'conservative',
  },
  LSG: {
    roles: { Wicketkeeper: 1.35, Batsman: 1.2 },
    sets: { WK1: 1.25, 'Set 2': 1.15 },
    personality: 'balanced',
  },
};

// How much squad fit affects valuation at each squad-building stage.
function getSquadFitWeight(squadSize, squadLimit) {
  const progress = squadLimit > 0 ? squadSize / squadLimit : 0;
  if (progress < 0.2) return 0.05;
  if (progress < 0.4) return 0.15;
  if (progress < 0.6) return 0.25;
  if (progress < 0.8) return 0.35;
  return 0.45;
}

function getPlayerFromSquadEntry(entry) {
  const playerId = typeof entry === 'string' ? entry : entry?.id;
  return IPL_PLAYERS.find((player) => player.id === playerId);
}

function normalizeRole(role = '') {
  const value = String(role).toLowerCase();
  if (value.includes('all')) return 'All-Rounder';
  if (value.includes('keep') || value === 'wk' || value.includes('wicket')) return 'Wicketkeeper';
  if (value.includes('bowl')) return 'Bowler';
  if (value.includes('bat')) return 'Batsman';
  return role || 'Unknown';
}

function getSquadProfile(squad = []) {
  const players = squad.map(getPlayerFromSquadEntry).filter(Boolean);
  const counts = {
    Batsman: 0,
    Bowler: 0,
    'All-Rounder': 0,
    Wicketkeeper: 0,
    Unknown: 0,
    overseas: 0,
    Indian: 0,
    pace: 0,
    spin: 0,
  };

  players.forEach((player) => {
    const role = normalizeRole(player.role);
    counts[role] = (counts[role] || 0) + 1;
    if (player.country && player.country !== 'IND') counts.overseas += 1;
    else counts.Indian += 1;

    // Use whichever bowling-style fields are present in the player data.
    const bowlingInfo = [
      player.bowlingStyle,
      player.bowlingType,
      player.bowling,
      player.style,
      player.specialism,
    ].filter(Boolean).join(' ').toLowerCase();

    if (/(spin|orthodox|leg.?break|off.?break|googly|chinaman)/.test(bowlingInfo)) {
      counts.spin += 1;
    } else if (/(fast|pace|seam|medium)/.test(bowlingInfo)) {
      counts.pace += 1;
    }
  });

  return { players, counts };
}

function getRoleNeedScore(player, profile, squadLimit) {
  const role = normalizeRole(player.role);
  const count = profile.counts[role] || 0;
  const size = profile.players.length;

  // Flexible targets scale with the selected auction mode. These are guides,
  // not quotas: an extra quality player can still receive a positive score.
  const targetShare = {
    Batsman: 0.32,
    Bowler: 0.32,
    'All-Rounder': 0.20,
    Wicketkeeper: 0.12,
  };
  const target = Math.max(1, Math.round(squadLimit * (targetShare[role] || 0.1)));
  const deficit = Math.max(0, target - count);

  // Missing roles receive a boost; repeated roles receive only a gradual
  // penalty, avoiding the old hard stop when a role count reached a cap.
  let score = deficit > 0
    ? Math.min(1, deficit / Math.max(1, target)) * 0.75
    : -Math.min(0.55, (count - target + 1) * 0.12);

  // A wicketkeeper is particularly useful in a playing XI, so avoid treating
  // the first keeper as just another low-frequency role.
  if (role === 'Wicketkeeper' && count === 0) score += 0.2;

  return Math.max(-0.6, Math.min(1, score));
}

function getBowlingVarietyScore(player, profile) {
  const role = normalizeRole(player.role);
  if (role !== 'Bowler' && role !== 'All-Rounder') return 0;

  const bowlingInfo = [
    player.bowlingStyle,
    player.bowlingType,
    player.bowling,
    player.style,
    player.specialism,
  ].filter(Boolean).join(' ').toLowerCase();

  const isSpin = /(spin|orthodox|leg.?break|off.?break|googly|chinaman)/.test(bowlingInfo);
  const isPace = /(fast|pace|seam|medium)/.test(bowlingInfo);

  if (isSpin && profile.counts.spin === 0) return 0.45;
  if (isPace && profile.counts.pace === 0) return 0.45;
  if (isSpin && profile.counts.spin > profile.counts.pace + 2) return -0.15;
  if (isPace && profile.counts.pace > profile.counts.spin + 2) return -0.15;
  return 0;
}

function calculateSquadFit(player, squad, squadLimit) {
  const profile = getSquadProfile(squad);
  const roleNeed = getRoleNeedScore(player, profile, squadLimit);
  const bowlingVariety = getBowlingVarietyScore(player, profile);
  const overseasCount = profile.counts.overseas;

  // Overseas players are useful, but Indian players become more valuable when
  // the overseas allowance is already being consumed.
  const overseasPressure = player.country && player.country !== 'IND'
    ? Math.min(0.25, overseasCount * 0.04)
    : 0;

  return Math.max(-1, Math.min(1, roleNeed + bowlingVariety - overseasPressure));
}

function computeBotValuation({
  player,
  botTeam,
  squadLimit,
  budgetRemaining,
  initialBudget,
}) {
  const basePrice = player.basePrice || 0.3;
  const set = player.set || 'Set 4';
  const tier = SET_TIER[set] || { base: 0.7, max: 1.1 };
  const prefs = TEAM_PREFERENCES[botTeam.teamId] || {};

  let personalityMult = 1;
  if (prefs.roles?.[player.role]) personalityMult *= prefs.roles[player.role];
  if (prefs.sets?.[set]) personalityMult *= prefs.sets[set];

  const willingnessFactor = tier.base + Math.random() * (tier.max - tier.base);
  const budgetUsed = 1 - budgetRemaining / (initialBudget || 120);
  const urgencyBoost = 1 + Math.max(0, budgetUsed) * 0.25;

  const squadSize = (botTeam.squad || []).length;
  const slotsLeft = squadLimit - squadSize;
  const squadUrgency = slotsLeft <= 3 ? 1.15 : 1;

  const fitScore = calculateSquadFit(player, botTeam.squad || [], squadLimit);
  const fitWeight = getSquadFitWeight(squadSize, squadLimit);
  // Convert fit into a controlled multiplier. Early in the auction this is
  // almost neutral; later it can meaningfully reward missing squad roles.
  const fitMultiplier = 1 + fitScore * fitWeight * 0.3;

  let maxVal = basePrice
    * willingnessFactor
    * personalityMult
    * urgencyBoost
    * squadUrgency
    * fitMultiplier;

  if (prefs.personality === 'aggressive') {
    maxVal = Math.min(maxVal, budgetRemaining * 0.4);
  } else if (prefs.personality === 'conservative') {
    maxVal = Math.min(maxVal, budgetRemaining * 0.25);
  } else if (prefs.personality === 'value') {
    maxVal = Math.min(maxVal, budgetRemaining * 0.3);
  } else {
    maxVal = Math.min(maxVal, budgetRemaining * 0.32);
  }

  return Number(Math.max(basePrice, maxVal).toFixed(2));
}

export function evaluateBotBid({
  player,
  currentBid,
  highBidderId,
  botTeam,
  squadLimit = 25,
  overseasLimit = 8,
  initialBudget = 120,
}) {
  if (!player || !botTeam) return null;

  const botUserId = botTeam.userId;
  const currentSquad = botTeam.squad || [];
  if (highBidderId === botUserId) return null;
  if (currentSquad.length >= squadLimit) return null;

  const profile = getSquadProfile(currentSquad);
  const isOverseas = player.country && player.country !== 'IND';
  if (isOverseas && profile.counts.overseas >= overseasLimit) return null;

  const currentBidAmount = currentBid || 0;
  const increment = currentBidAmount < 5 ? 0.2 : 0.25;
  const nextBid = currentBidAmount === 0
    ? (player.basePrice || 0.3)
    : Number((currentBidAmount + increment).toFixed(2));

  const budgetRemaining = botTeam.budgetRemaining ?? initialBudget;
  if (budgetRemaining < nextBid) return null;

  const slotsRemaining = squadLimit - currentSquad.length;
  const remainingAfterBid = budgetRemaining - nextBid;

  // Keep a modest reserve for the remaining squad, but relax it as the squad
  // fills. The minimum is not a role quota and does not block a role outright.
  const minimumReservePerSlot = squadLimit <= 5 ? 0 : 0.2;
  if (
    slotsRemaining > 1 &&
    remainingAfterBid / (slotsRemaining - 1) < minimumReservePerSlot
  ) {
    return null;
  }

  const maxValuation = computeBotValuation({
    player,
    botTeam,
    squadLimit,
    budgetRemaining,
    initialBudget,
  });

  if (nextBid > maxValuation) return null;

  const priceRatio = nextBid / Math.max(maxValuation, 0.01);
  const baseBidChance = priceRatio < 0.5 ? 0.95
    : priceRatio < 0.7 ? 0.82
      : priceRatio < 0.85 ? 0.65
        : 0.4;

  if (Math.random() > baseBidChance) return null;

  return {
    shouldBid: true,
    botUserId,
    teamId: botTeam.teamId,
    nextBid,
    maxValuation,
    squadFitScore: Number(calculateSquadFit(player, currentSquad, squadLimit).toFixed(2)),
  };
}
