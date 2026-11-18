import { IPL_PLAYERS } from '../data/players';

const clamp = (value, min, max) =>
  Math.max(min, Math.min(max, value));

/* =========================================================
   ROLE HELPERS
========================================================= */

function normalizeRole(role = '') {
  const value = String(role).toLowerCase().trim();

  if (
    value.includes('all-rounder') ||
    value.includes('allrounder') ||
    value.includes('all rounder')
  ) {
    return 'All-Rounder';
  }

  if (
    value.includes('wicket') ||
    value.includes('keeper')
  ) {
    return 'Wicketkeeper';
  }

  if (value.includes('bowl')) {
    return 'Bowler';
  }

  if (value.includes('bat')) {
    return 'Batsman';
  }

  return 'Other';
}

function getPlayerRole(player) {
  return normalizeRole(
    player?.role ||
    player?.type ||
    player?.playerType ||
    ''
  );
}

function isAllRounder(player) {
  return getPlayerRole(player) === 'All-Rounder';
}

/* =========================================================
   FAIR VALUE
========================================================= */

/**
 * Calculate estimated fair auction value.
 *
 * Higher-rated players have a higher expected value.
 * Base price is always respected as the minimum.
 */
export function calculateFairValue(player) {
  if (!player) return 0;

  const rating = Number(player.rating || 0);
  const basePrice = Number(player.basePrice || 0);

  if (rating <= 0) {
    return basePrice;
  }

  /*
   * Approximate examples:
   *
   * 70 rating -> ~3.0 Cr
   * 80 rating -> ~4.0 Cr
   * 86 rating -> ~4.6 Cr
   * 90 rating -> ~5.0 Cr
   */
  const ratingValue =
    1 + Math.max(0, rating - 50) * 0.10;

  return Number(
    Math.max(basePrice, ratingValue).toFixed(2)
  );
}

/* =========================================================
   AUCTION VALUE
========================================================= */

/**
 * Determine how good the purchase price was.
 */
export function calculateAuctionValue(player, bid = 0) {
  if (!player) {
    return {
      fairValue: 0,
      purchasePrice: 0,
      priceRatio: 1,
      valueMultiplier: 1,
      valueScore: 50
    };
  }

  const fairValue =
    calculateFairValue(player);

  const purchasePrice =
    Number(
      bid ||
      player.basePrice ||
      0
    );

  if (fairValue <= 0) {
    return {
      fairValue: 0,
      purchasePrice,
      priceRatio: 1,
      valueMultiplier: 1,
      valueScore: 50
    };
  }

  const priceRatio =
    purchasePrice / fairValue;

  let valueMultiplier;
  let valueScore;

  if (priceRatio <= 0.45) {
    valueMultiplier = 1.12;
    valueScore = 100;
  }
  else if (priceRatio <= 0.65) {
    valueMultiplier = 1.07;
    valueScore = 92;
  }
  else if (priceRatio <= 0.85) {
    valueMultiplier = 1.03;
    valueScore = 82;
  }
  else if (priceRatio <= 1.05) {
    valueMultiplier = 1.00;
    valueScore = 70;
  }
  else if (priceRatio <= 1.25) {
    valueMultiplier = 0.97;
    valueScore = 60;
  }
  else if (priceRatio <= 1.50) {
    valueMultiplier = 0.94;
    valueScore = 48;
  }
  else if (priceRatio <= 1.80) {
    valueMultiplier = 0.91;
    valueScore = 36;
  }
  else if (priceRatio <= 2.20) {
    valueMultiplier = 0.88;
    valueScore = 25;
  }
  else {
    valueMultiplier = 0.85;
    valueScore = 15;
  }

  return {
    fairValue: Number(
      fairValue.toFixed(2)
    ),

    purchasePrice,

    priceRatio: Number(
      priceRatio.toFixed(2)
    ),

    valueMultiplier,

    valueScore
  };
}

/* =========================================================
   PLAYER AUCTION RATING
========================================================= */

/**
 * Calculate the player's auction-adjusted rating.
 *
 * Original player rating is always the foundation.
 *
 * Auction value modifies the rating, but cannot
 * completely redefine the quality of the player.
 */
export function calculatePlayerAuctionRating(
  player,
  bid = 0
) {
  if (!player) return 0;

  const baseRating =
    Number(player.rating || 0);

  if (baseRating <= 0) {
    return 0;
  }

  const auctionValue =
    calculateAuctionValue(
      player,
      bid
    );

  let multiplier =
    auctionValue.valueMultiplier;

  /*
   * ALL-ROUNDER PROTECTION
   *
   * All-rounders provide value in two disciplines.
   *
   * Great bargain:
   *   Still rewarded.
   *
   * Normal purchase:
   *   Almost unchanged.
   *
   * Overpay:
   *   Penalty is reduced.
   *
   * We do not give all-rounders a free rating boost.
   */
  if (isAllRounder(player)) {

    if (multiplier > 1) {

      multiplier =
        1 +
        ((multiplier - 1) * 0.85);

    } else if (multiplier < 1) {

      multiplier =
        1 -
        ((1 - multiplier) * 0.65);
    }
  }

  const adjustedRating =
    baseRating * multiplier;

  /*
   * Protect the player's original quality.
   *
   * Minimum:
   *   82% of base rating
   *
   * Maximum:
   *   115% of base rating
   */
  const minimumRating =
    baseRating * 0.82;

  const maximumRating =
    baseRating * 1.15;

  return Number(
  Math.min(
    100,
    clamp(adjustedRating, baseRating * 0.82, baseRating * 1.15)
  ).toFixed(1)
);
}

/* =========================================================
   SQUAD ROLE ANALYSIS
========================================================= */

/**
 * Count the roles inside a squad.
 *
 * All-rounders are also treated as partial batting
 * and bowling cover because they can contribute in
 * both disciplines.
 */
function getSquadRoleCounts(squad = []) {
  const counts = {
    Batsman: 0,
    Bowler: 0,
    'All-Rounder': 0,
    Wicketkeeper: 0,
    Other: 0
  };

  if (!Array.isArray(squad)) {
    return counts;
  }

  squad.forEach((squadPlayer) => {

    const playerId =
      typeof squadPlayer === 'string'
        ? squadPlayer
        : squadPlayer?.id;

    const player =
      IPL_PLAYERS.find(
        (p) => p.id === playerId
      );

    if (!player) return;

    const role =
      getPlayerRole(player);

    if (
      Object.prototype.hasOwnProperty.call(
        counts,
        role
      )
    ) {
      counts[role]++;
    } else {
      counts.Other++;
    }
  });

  return counts;
}

/* =========================================================
   SQUAD FIT
========================================================= */

/**
 * Calculate how well the current squad can eventually
 * construct a balanced Playing XI.
 *
 * IMPORTANT:
 *
 * Squad fit is deliberately NOT heavily considered
 * during the early auction.
 *
 * 1-9 players:
 *   Almost no squad-fit influence.
 *
 * 10-12:
 *   Squad fit starts becoming relevant.
 *
 * 13-17:
 *   Moderate influence.
 *
 * 18+:
 *   Full squad-fit evaluation.
 *
 * This prevents a team with only 3-5 players from being
 * incorrectly judged as having a bad squad simply because
 * it hasn't purchased enough bowlers/wicketkeepers yet.
 */
export function calculateSquadFit(squad = []) {

  if (
    !Array.isArray(squad) ||
    squad.length === 0
  ) {
    return {
      squadFitScore: 50,
      squadFitMultiplier: 1,
      roleCounts: {
        Batsman: 0,
        Bowler: 0,
        'All-Rounder': 0,
        Wicketkeeper: 0,
        Other: 0
      },
      fitInfluence: 0,
      stage: 'EARLY'
    };
  }

  const counts =
    getSquadRoleCounts(squad);

  /*
   * Ideal minimum composition for a Playing XI.
   *
   * We are not forcing exactly this composition.
   * It is simply the reference point for determining
   * whether the squad has enough coverage.
   */
  const TARGETS = {
    Batsman: 4,
    Bowler: 4,
    'All-Rounder': 2,
    Wicketkeeper: 1
  };

  /*
   * Once a role becomes excessively concentrated,
   * additional players of that role contribute less
   * to squad balance.
   */
  const MAX_USEFUL = {
    Batsman: 8,
    Bowler: 8,
    'All-Rounder': 5,
    Wicketkeeper: 3
  };

  /*
   * All-rounders provide partial batting and bowling
   * coverage.
   */
  const effectiveBatsmen =
    counts.Batsman +
    (counts['All-Rounder'] * 0.5);

  const effectiveBowlers =
    counts.Bowler +
    (counts['All-Rounder'] * 0.5);

  /* ---------------------------------------------
     BATTING SCORE
  --------------------------------------------- */

  let battingScore;

  if (
    effectiveBatsmen >=
    TARGETS.Batsman
  ) {

    const extra =
      effectiveBatsmen -
      TARGETS.Batsman;

    battingScore =
      Math.max(
        80,
        100 -
        (extra * 6)
      );

  } else {

    battingScore =
      (
        effectiveBatsmen /
        TARGETS.Batsman
      ) * 100;
  }

  /* ---------------------------------------------
     BOWLING SCORE
  --------------------------------------------- */

  let bowlingScore;

  if (
    effectiveBowlers >=
    TARGETS.Bowler
  ) {

    const extra =
      effectiveBowlers -
      TARGETS.Bowler;

    bowlingScore =
      Math.max(
        80,
        100 -
        (extra * 6)
      );

  } else {

    bowlingScore =
      (
        effectiveBowlers /
        TARGETS.Bowler
      ) * 100;
  }

  /* ---------------------------------------------
     ALL-ROUNDER SCORE
  --------------------------------------------- */

  let allRounderScore;

  if (
    counts['All-Rounder'] >=
    TARGETS['All-Rounder']
  ) {

    const extra =
      counts['All-Rounder'] -
      TARGETS['All-Rounder'];

    allRounderScore =
      Math.max(
        80,
        100 -
        (extra * 8)
      );

  } else {

    allRounderScore =
      (
        counts['All-Rounder'] /
        TARGETS['All-Rounder']
      ) * 100;
  }

  /* ---------------------------------------------
     WICKETKEEPER SCORE
  --------------------------------------------- */

  let wicketkeeperScore;

  if (
    counts.Wicketkeeper >=
    TARGETS.Wicketkeeper
  ) {

    const extra =
      counts.Wicketkeeper -
      TARGETS.Wicketkeeper;

    wicketkeeperScore =
      Math.max(
        80,
        100 -
        (extra * 10)
      );

  } else {

    wicketkeeperScore =
      (
        counts.Wicketkeeper /
        TARGETS.Wicketkeeper
      ) * 100;
  }

  /*
   * Weighted role balance.
   *
   * Batting and bowling are most important.
   * All-rounders and wicketkeepers provide additional
   * squad flexibility.
   */
  let rawFitScore =
    (
      (battingScore * 0.30) +
      (bowlingScore * 0.30) +
      (allRounderScore * 0.20) +
      (wicketkeeperScore * 0.20)
    );

  /*
   * Penalize a squad that is extremely concentrated
   * in one role.
   *
   * This matters more when the squad is large enough
   * for us to reasonably judge its final composition.
   */
  const totalCorePlayers =
    counts.Batsman +
    counts.Bowler +
    counts['All-Rounder'] +
    counts.Wicketkeeper;

  if (totalCorePlayers > 0) {

    const largestRole =
      Math.max(
        counts.Batsman,
        counts.Bowler,
        counts['All-Rounder'],
        counts.Wicketkeeper
      );

    const concentration =
      largestRole /
      totalCorePlayers;

    /*
     * Only apply a meaningful concentration penalty
     * when one role becomes disproportionately large.
     */
    if (concentration > 0.60) {

      const penalty =
        (concentration - 0.60) *
        35;

      rawFitScore -= penalty;
    }
  }

  /*
   * Small squads should naturally have incomplete roles.
   *
   * Therefore we pull their score toward 50.
   *
   * At 1 player:
   *   Almost no squad-fit effect.
   *
   * At 10 players:
   *   Squad composition becomes meaningful.
   *
   * At 18 players:
   *   Full squad evaluation.
   */
  const squadSize =
    squad.length;

  let maturity;

  if (squadSize < 10) {

    /*
     * 1-9 players:
     * Very small influence.
     */
    maturity =
      squadSize / 90;

  } else if (squadSize < 13) {

    /*
     * 10-12 players:
     * Gradual start.
     */
    maturity =
      0.10 +
      (
        (squadSize - 10) /
        3
      ) * 0.15;

  } else if (squadSize < 18) {

    /*
     * 13-17 players:
     * Moderate squad-fit influence.
     */
    maturity =
      0.25 +
      (
        (squadSize - 13) /
        5
      ) * 0.25;

  } else {

    /*
     * 18-25 players:
     * Full squad-fit influence.
     */
    maturity =
      0.50 +
      (
        Math.min(
          squadSize - 18,
          7
        ) /
        7
      ) * 0.50;
  }

  maturity =
    clamp(
      maturity,
      0,
      1
    );

  /*
   * Pull raw score toward 50 for immature squads.
   *
   * Example:
   *
   * Raw fit = 20
   *
   * At 5 players:
   *   Effective fit remains close to 50.
   *
   * At 20 players:
   *   Effective fit approaches 20.
   */
  const effectiveFitScore =
    50 +
    (
      (rawFitScore - 50) *
      maturity
    );

  /*
   * Convert squad fit score into a rating multiplier.
   *
   * 50 score -> 1.00
   * 100 score -> 1.06
   * 0 score -> 0.94
   *
   * Squad fit can therefore influence the team,
   * but it can NEVER completely overpower player quality.
   */
  const squadFitMultiplier =
    1 +
    (
      (
        effectiveFitScore -
        50
      ) /
      50
    ) * 0.06;

  let stage;

  if (squadSize < 10) {
    stage = 'EARLY';
  } else if (squadSize < 13) {
    stage = 'STARTING';
  } else if (squadSize < 18) {
    stage = 'BALANCING';
  } else {
    stage = 'FULL_SQUAD';
  }

  return {
    squadFitScore: Number(
      clamp(
        effectiveFitScore,
        0,
        100
      ).toFixed(1)
    ),

    squadFitMultiplier: Number(
      squadFitMultiplier.toFixed(4)
    ),

    roleCounts: counts,

    fitInfluence: Number(
      (maturity * 100).toFixed(1)
    ),

    stage
  };
}

/* =========================================================
   COMPLETE TEAM RATING
========================================================= */

/**
 * Calculate complete team rating.
 *
 * Final rating combines:
 *
 * 1. Original player quality
 * 2. Auction value
 * 3. Squad fit
 *
 * Squad fit becomes increasingly important only after
 * the team reaches around 10 players.
 */
export function calculateTeamRating(
  squad = []
) {

  if (
    !Array.isArray(squad) ||
    squad.length === 0
  ) {
    return {
      avgRating: 0,
      qualityRating: 0,
      valueRating: 0,
      squadFitRating: 50,
      squadFitMultiplier: 1,
      totalRating: 0,
      auctionAdjustedRating: 0,
      playersEvaluated: 0
    };
  }

  let qualityTotal = 0;
  let adjustedTotal = 0;
  let valueScoreTotal = 0;

  let playersEvaluated = 0;

  squad.forEach((squadPlayer) => {

    const playerId =
      typeof squadPlayer === 'string'
        ? squadPlayer
        : squadPlayer?.id;

    const player =
      IPL_PLAYERS.find(
        (p) => p.id === playerId
      );

    if (!player) return;

    const bid =
      typeof squadPlayer === 'object'
        ? Number(
            squadPlayer.bid ||
            squadPlayer.bidVal ||
            player.basePrice ||
            0
          )
        : Number(
            player.basePrice || 0
          );

    const baseRating =
      Number(player.rating || 0);

    const adjustedRating =
      calculatePlayerAuctionRating(
        player,
        bid
      );

    const auctionValue =
      calculateAuctionValue(
        player,
        bid
      );

    qualityTotal +=
      baseRating;

    adjustedTotal +=
      adjustedRating;

    valueScoreTotal +=
      auctionValue.valueScore;

    playersEvaluated++;
  });

  if (playersEvaluated === 0) {
    return {
      avgRating: 0,
      qualityRating: 0,
      valueRating: 0,
      squadFitRating: 50,
      squadFitMultiplier: 1,
      totalRating: 0,
      auctionAdjustedRating: 0,
      playersEvaluated: 0
    };
  }

  /* ---------------------------------------------
     BASE TEAM METRICS
  --------------------------------------------- */

  const qualityRating =
    qualityTotal /
    playersEvaluated;

  const valueRating =
    valueScoreTotal /
    playersEvaluated;

  /*
   * This is the team rating BEFORE squad fit.
   */
  const auctionAdjustedRating =
    adjustedTotal /
    playersEvaluated;

  /* ---------------------------------------------
     SQUAD FIT
  --------------------------------------------- */

  const squadFit =
    calculateSquadFit(
      squad
    );

  /*
   * Apply squad fit only after the team has enough
   * players for it to be meaningful.
   *
   * calculateSquadFit() already controls the influence.
   */
  const finalRating =
    auctionAdjustedRating *
    squadFit.squadFitMultiplier;

  const finalTotalRating =
    finalRating *
    playersEvaluated;

  return {
    /*
     * FINAL TEAM RATING
     *
     * This is the value that AuctionRoom should show.
     */
    avgRating: Number(
      finalRating.toFixed(1)
    ),

    /*
     * Original player-quality average.
     */
    qualityRating: Number(
      qualityRating.toFixed(1)
    ),

    /*
     * Auction-value score.
     */
    valueRating: Number(
      valueRating.toFixed(1)
    ),

    /*
     * Squad balance score.
     */
    squadFitRating:
      squadFit.squadFitScore,

    /*
     * Actual multiplier applied.
     */
    squadFitMultiplier:
      squadFit.squadFitMultiplier,

    /*
     * Total final rating across players.
     */
    totalRating: Number(
      finalTotalRating.toFixed(1)
    ),

    /*
     * Team rating before squad-fit adjustment.
     *
     * Useful for debugging/UI later.
     */
    auctionAdjustedRating: Number(
      auctionAdjustedRating.toFixed(1)
    ),

    /*
     * Extra squad information.
     */
    roleCounts:
      squadFit.roleCounts,

    fitInfluence:
      squadFit.fitInfluence,

    squadFitStage:
      squadFit.stage,

    playersEvaluated
  };
}

/* =========================================================
   AUCTION VALUE LABEL
========================================================= */

/**
 * Return a readable auction-value label.
 */
export function getAuctionValueLabel(
  player,
  bid = 0
) {

  const auctionValue =
    calculateAuctionValue(
      player,
      bid
    );

  const {
    valueScore,
    priceRatio
  } = auctionValue;

  if (priceRatio <= 0.45) {
    return {
      label: 'STEAL',
      score: valueScore
    };
  }

  if (priceRatio <= 0.65) {
    return {
      label: 'GREAT PICK',
      score: valueScore
    };
  }

  if (priceRatio <= 0.85) {
    return {
      label: 'GOOD VALUE',
      score: valueScore
    };
  }

  if (priceRatio <= 1.05) {
    return {
      label: 'FAIR PRICE',
      score: valueScore
    };
  }

  if (priceRatio <= 1.25) {
    return {
      label: 'SLIGHTLY HIGH',
      score: valueScore
    };
  }

  if (priceRatio <= 1.50) {
    return {
      label: 'OVERPAID',
      score: valueScore
    };
  }

  if (priceRatio <= 1.80) {
    return {
      label: 'EXPENSIVE',
      score: valueScore
    };
  }

  return {
    label: 'HEAVY OVERPAY',
    score: valueScore
  };
}