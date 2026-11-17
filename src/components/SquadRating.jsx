import React, { useMemo, useState } from 'react'
import {
  Users,
  Star,
  ArrowLeft,
  IndianRupee,
  Trophy,
  Shield
} from 'lucide-react'
import { motion } from 'framer-motion'

import {
  calculateTeamRating,
  calculatePlayerAuctionRating
} from '../lib/ratingEngine'

import { TEAMS } from '../data/teams'
import { IPL_PLAYERS } from '../data/players'

const SquadRating = ({ roomTeams = [], currentAuction }) => {

  const [selectedTeamId, setSelectedTeamId] = useState(null)

  // ---------------------------------------------------------
  // Minimum squad size
  // ---------------------------------------------------------

  const minPlayers = useMemo(() => {
    const type = currentAuction?.auctionType || 'mega'

    if (type === 'mega') return 18
    if (type === 'sprint11') return 11
    if (type === 'sprint5') return 5

    return currentAuction?.settings?.minPlayers || 18
  }, [currentAuction])


  // ---------------------------------------------------------
  // Calculate team leaderboard
  // ---------------------------------------------------------

  const calculatedLeaderboard = useMemo(() => {

    return roomTeams
      .map(team => {

        const {
          userId,
          userName,
          teamId,
          squad = []
        } = team

        const ratingInfo = calculateTeamRating(squad)

        const teamInfo = TEAMS.find(
          t => String(t.id) === String(teamId)
        )

        const normalizedPlayers = squad.map(
          p =>
            typeof p === 'string'
              ? p
              : (p?.id || p?.playerId || p)
        )

        const playerCount = normalizedPlayers.length

        const isDisqualified =
          playerCount < minPlayers

        return {
          userId,
          userName:
            userName ||
            teamInfo?.name ||
            teamId,

          teamId,

          teamName:
            teamInfo?.name ||
            teamId,

          teamLogo:
            teamInfo?.logo ||
            null,

          avgRating:
            ratingInfo.avgRating,

          qualityRating:
            ratingInfo.qualityRating,

          valueRating:
            ratingInfo.valueRating,

          totalRating:
            ratingInfo.totalRating,

          playersEvaluated:
            ratingInfo.playersEvaluated,

          playerCount,

          isDisqualified,

          // IMPORTANT:
          // Preserve original squad for detail view
          squad
        }
      })
      .sort((a, b) => {

        if (
          a.isDisqualified !==
          b.isDisqualified
        ) {
          return a.isDisqualified
            ? 1
            : -1
        }

        if (
          b.avgRating !==
          a.avgRating
        ) {
          return (
            b.avgRating -
            a.avgRating
          )
        }

        if (
          b.qualityRating !==
          a.qualityRating
        ) {
          return (
            b.qualityRating -
            a.qualityRating
          )
        }

        return a.teamName.localeCompare(
          b.teamName
        )
      })

  }, [roomTeams, minPlayers])


  // ---------------------------------------------------------
  // Selected team
  // ---------------------------------------------------------

  const selectedTeam = useMemo(() => {

    if (!selectedTeamId) {
      return null
    }

    return calculatedLeaderboard.find(
      team =>
        String(team.teamId) ===
        String(selectedTeamId)
    )

  }, [
    selectedTeamId,
    calculatedLeaderboard
  ])


  // ---------------------------------------------------------
  // Convert squad entries into player details
  // ---------------------------------------------------------

  const selectedSquadPlayers = useMemo(() => {

    if (!selectedTeam) {
      return []
    }

    return selectedTeam.squad
      .map(entry => {

        const playerId =
          typeof entry === 'string'
            ? entry
            : (
                entry?.id ??
                entry?.playerId
              )

        const bid =
          typeof entry === 'string'
            ? 0
            : Number(
                entry?.bid ??
                entry?.purchasePrice ??
                entry?.price ??
                0
              )

        const playerInfo =
          IPL_PLAYERS.find(
            player =>
              String(player.id) ===
              String(playerId)
          )

        if (!playerInfo) {
          return null
        }

        const originalRating =
          Number(playerInfo.rating) || 0

        const auctionRating =
          bid > 0
            ? calculatePlayerAuctionRating(
                playerInfo,
                bid
              )
            : originalRating

        return {
          ...playerInfo,

          bid,

          originalRating,

          auctionRating
        }

      })
      .filter(Boolean)

  }, [selectedTeam])


  // ---------------------------------------------------------
  // No squads
  // ---------------------------------------------------------

  if (roomTeams.length === 0) {

    return (
      <div className="flex flex-col items-center justify-center p-8 text-center h-full">

        <Users className="w-16 h-16 text-gray-600 mb-4" />

        <h3 className="text-xl font-bold text-gray-300">
          No Squads Yet
        </h3>

        <p className="text-gray-500 mt-2">
          Squad ratings will appear once franchises start buying players.
        </p>

      </div>
    )
  }


  // =========================================================
  // TEAM DETAIL VIEW
  // =========================================================

  if (selectedTeam) {

    return (
      <div className="space-y-5 sm:space-y-6">

        {/* Back button */}

        <button
          type="button"
          onClick={() => setSelectedTeamId(null)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-gray-300 hover:text-white hover:border-orange-500/40 transition"
        >
          <ArrowLeft className="w-4 h-4" />

          <span className="text-sm font-semibold">
            Back to Squad Ratings
          </span>
        </button>


        {/* Team header */}

        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c0c] p-5 sm:p-7">

          <div className="absolute -top-24 -right-24 w-56 h-56 bg-orange-500/10 blur-3xl rounded-full pointer-events-none" />

          <div className="relative flex items-center gap-4 sm:gap-6">

            {/* Team logo */}

            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center overflow-hidden shrink-0">

              {selectedTeam.teamLogo ? (
                <img
                  src={selectedTeam.teamLogo}
                  alt={selectedTeam.teamName}
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <Shield className="w-8 h-8 text-orange-500" />
              )}

            </div>


            {/* Team name */}

            <div className="flex-1 min-w-0">

              <p className="text-xs text-orange-500 font-bold uppercase tracking-widest">
                Squad Details
              </p>

              <h2 className="text-2xl sm:text-3xl font-black text-white truncate">
                {selectedTeam.teamName}
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                {selectedTeam.playerCount} players
              </p>

            </div>


            {/* Overall rating */}

            <div className="hidden sm:flex flex-col items-end">

              <span className="text-xs text-gray-500 uppercase font-bold">
                Squad Rating
              </span>

              <div className="flex items-center gap-2 mt-1">

                <Star className="w-5 h-5 fill-orange-500 text-orange-500" />

                <span className="text-3xl font-black text-orange-400">
                  {Number(
                    selectedTeam.avgRating || 0
                  ).toFixed(1)}
                </span>

              </div>

            </div>

          </div>


          {/* Mobile rating */}

          <div className="sm:hidden mt-5 pt-4 border-t border-white/5 flex items-center justify-between">

            <span className="text-xs text-gray-500 uppercase font-bold">
              Squad Rating
            </span>

            <div className="flex items-center gap-2">

              <Star className="w-4 h-4 fill-orange-500 text-orange-500" />

              <span className="text-xl font-black text-orange-400">
                {Number(
                  selectedTeam.avgRating || 0
                ).toFixed(1)}
              </span>

            </div>

          </div>

        </div>


        {/* Explanation */}

        <div className="rounded-2xl border border-orange-500/10 bg-orange-500/[0.03] p-4">

          <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
            <span className="text-orange-400 font-bold">
              Auction Rating
            </span>{' '}
            reflects the player's original rating together with the
            value of the price paid during the auction.
          </p>

        </div>


        {/* Player list */}

        <div className="space-y-3">

          {selectedSquadPlayers.length === 0 ? (

            <div className="text-center py-12 text-gray-500">
              No player details available.
            </div>

          ) : (

            selectedSquadPlayers.map(
              (player, index) => (

                <motion.div
                  key={player.id}
                  initial={{
                    opacity: 0,
                    y: 10
                  }}
                  animate={{
                    opacity: 1,
                    y: 0
                  }}
                  transition={{
                    delay: index * 0.04
                  }}
                  className="rounded-2xl sm:rounded-3xl border border-white/5 bg-[#0c0c0c] hover:border-white/10 transition overflow-hidden"
                >

                  <div className="p-4 sm:p-5">

                    <div className="flex items-center gap-3 sm:gap-5">

                      {/* Player image */}

                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-white/[0.04] border border-white/5 shrink-0">

                        {player.image ? (
                          <img
                            src={player.image}
                            alt={player.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Users className="w-6 h-6 text-gray-600" />
                          </div>
                        )}

                      </div>


                      {/* Player information */}

                      <div className="flex-1 min-w-0">

                        <h3 className="font-bold text-white truncate">
                          {player.name}
                        </h3>

                        <p className="text-xs text-gray-500 mt-1">
                          {player.role || 'Player'}
                        </p>

                      </div>


                      {/* Ratings */}

                      <div className="hidden md:grid grid-cols-2 gap-8">

                        <div className="text-center">

                          <p className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">
                            Original
                          </p>

                          <p className="text-xl font-black text-gray-300 mt-1">
                            {player.originalRating}
                          </p>

                        </div>


                        <div className="text-center">

                          <p className="text-[10px] uppercase tracking-wider text-orange-500 font-bold">
                            Auction
                          </p>

                          <p className="text-xl font-black text-orange-400 mt-1">
                            {Number(
                              player.auctionRating || 0
                            ).toFixed(1)}
                          </p>

                        </div>

                      </div>


                      {/* Bought for */}

                      <div className="text-right min-w-[80px] sm:min-w-[100px]">

                        <p className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">
                          Bought For
                        </p>

                        <div className="flex items-center justify-end gap-0.5 mt-1">

                          <IndianRupee className="w-3.5 h-3.5 text-green-500" />

                          <span className="text-base sm:text-lg font-black text-green-400">
                            {Number(
                              player.bid || 0
                            ).toFixed(2)}
                          </span>

                          <span className="text-[10px] text-gray-500 ml-0.5">
                            Cr
                          </span>

                        </div>

                      </div>

                    </div>


                    {/* Mobile ratings */}

                    <div className="md:hidden grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/5">

                      <div className="rounded-xl bg-white/[0.03] p-3">

                        <p className="text-[10px] uppercase text-gray-600 font-bold">
                          Original Rating
                        </p>

                        <p className="text-lg font-black text-gray-300 mt-1">
                          {player.originalRating}
                        </p>

                      </div>


                      <div className="rounded-xl bg-orange-500/[0.04] p-3">

                        <p className="text-[10px] uppercase text-orange-500 font-bold">
                          Auction Rating
                        </p>

                        <p className="text-lg font-black text-orange-400 mt-1">
                          {Number(
                            player.auctionRating || 0
                          ).toFixed(1)}
                        </p>

                      </div>

                    </div>

                  </div>

                </motion.div>

              )
            )

          )}

        </div>

      </div>
    )
  }


  // =========================================================
  // TEAM LEADERBOARD VIEW
  // =========================================================

  return (
    <div className="space-y-3 sm:space-y-4">

      {/* Header */}

      <div className="flex items-center gap-3 mb-6 sm:mb-8 px-2 sm:px-0">

        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">
            Franchise Strength
          </h2>

          <p className="text-xs sm:text-sm text-gray-400">
            Click a franchise to view its squad
          </p>
        </div>

      </div>


      {/* Team cards */}

      <div className="space-y-3 sm:space-y-4">

        {calculatedLeaderboard.map(
          (team, idx) => (

            <motion.button
              key={team.teamId}
              type="button"
              onClick={() =>
                setSelectedTeamId(team.teamId)
              }
              initial={{
                opacity: 0,
                y: 10
              }}
              animate={{
                opacity: 1,
                y: 0
              }}
              transition={{
                delay: idx * 0.1
              }}
              className={`w-full text-left flex flex-row items-center justify-between p-3 sm:p-6 rounded-2xl sm:rounded-[2.5rem] bg-[#0c0c0c] border transition-all duration-300 relative overflow-hidden group gap-2 sm:gap-4 ${
                team.isDisqualified
                  ? 'border-red-900/30 opacity-70 grayscale-[0.5]'
                  : idx === 0
                    ? 'border-orange-500/50 shadow-2xl'
                    : 'border-white/5 hover:border-orange-500/30'
              }`}
            >

              {/* Team logo */}

              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-white/[0.04] border border-white/5 flex items-center justify-center overflow-hidden shrink-0">

                {team.teamLogo ? (
                  <img
                    src={team.teamLogo}
                    alt={team.teamName}
                    className="w-full h-full object-contain p-2"
                  />
                ) : (
                  <Shield className="w-6 h-6 text-gray-600" />
                )}

              </div>


              {/* Team information */}

              <div className="flex-1 min-w-0">

                <div className="flex items-center gap-2">

                  <h3 className="text-sm sm:text-lg font-black text-white truncate">
                    {team.teamName}
                  </h3>

                  {idx === 0 &&
                    !team.isDisqualified && (
                      <Trophy className="w-4 h-4 text-orange-500 shrink-0" />
                    )}

                </div>

                <p className="text-xs text-gray-500 mt-1">
                  {team.playerCount} players
                </p>

              </div>


              {/* Rating */}

              <div className="flex flex-col items-end shrink-0">

                <div className="flex items-center gap-1.5">

                  <Star className="w-4 h-4 fill-orange-500 text-orange-500" />

                  <span className="text-lg sm:text-2xl font-black text-orange-400">
                    {Number(
                      team.avgRating || 0
                    ).toFixed(1)}
                  </span>

                </div>

                <span className="text-[9px] sm:text-[10px] text-gray-600 uppercase font-bold">
                  Squad Rating
                </span>

              </div>


              {/* Arrow */}

              <div className="hidden sm:flex w-9 h-9 rounded-xl bg-white/[0.03] border border-white/5 items-center justify-center group-hover:bg-orange-500 group-hover:border-orange-500 transition">

                <span className="text-gray-500 group-hover:text-black font-bold">
                  →
                </span>

              </div>

            </motion.button>

          )
        )}

      </div>

    </div>
  )
}

export default SquadRating