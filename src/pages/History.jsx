import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  History as HistoryIcon,
  Trophy,
  Calendar,
  ChevronRight,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'

const History = () => {
  const navigate = useNavigate()

  const [auctions, setAuctions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true)
        setError('')

        const { data, error: fetchError } = await supabase
          .from('auctions')
          .select('*')
          .eq('status', 'completed')
          .order('created_at', { ascending: false })

        if (fetchError) {
          throw fetchError
        }

        setAuctions(data || [])
      } catch (err) {
        console.error('Failed to load auction history:', err)
        setError('Unable to load auction history.')
      } finally {
        setLoading(false)
      }
    }

    loadHistory()
  }, [])

  const formatDate = (value) => {
    if (!value) return 'Unknown date'

    try {
      return new Date(value).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return 'Unknown date'
    }
  }

  const getAuctionType = (auction) => {
    const type = auction?.auction_type || auction?.auctionType

    if (type === 'sprint5') return 'Sprint 5'
    if (type === 'sprint11') return 'Sprint 11'

    return 'Mega Auction'
  }

  const getAuctionTitle = (auction) => {
    return (
      auction?.name ||
      auction?.title ||
      auction?.auction_name ||
      'IPL Auction'
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />

          <p className="text-gray-400 text-sm">
            Loading auction history...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center px-6">
        <div className="max-w-md w-full rounded-3xl border border-red-500/20 bg-[#0c0c0c] p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />

          <h2 className="text-xl font-bold text-white">
            Unable to Load History
          </h2>

          <p className="text-gray-500 mt-2">
            {error}
          </p>

          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold transition"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">

      {/* Header */}
      <div className="border-b border-white/5 bg-[#080808]/95 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">

          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <HistoryIcon className="w-5 h-5 text-orange-500" />
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight">
                Auction History
              </h1>

              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                View completed auctions and squad ratings
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {auctions.length === 0 ? (
          <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">

            <div className="w-20 h-20 rounded-3xl bg-white/[0.03] border border-white/5 flex items-center justify-center mb-5">
              <Trophy className="w-9 h-9 text-gray-600" />
            </div>

            <h2 className="text-xl font-bold text-gray-300">
              No Completed Auctions
            </h2>

            <p className="text-gray-600 mt-2 max-w-sm">
              Completed auctions will appear here once an auction has finished.
            </p>

            <button
              onClick={() => navigate('/')}
              className="mt-6 px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold transition"
            >
              Back to Home
            </button>

          </div>
        ) : (
          <div className="space-y-4">

            {auctions.map((auction, index) => (
              <motion.button
                key={auction.id}
                type="button"
                onClick={() => navigate(`/summary/${auction.id}`)}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="w-full text-left group"
              >
                <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-[#0c0c0c] hover:border-orange-500/30 transition-all duration-300">

                  {/* Orange hover glow */}
                  <div className="absolute inset-0 bg-orange-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="relative p-5 sm:p-6 flex items-center gap-4 sm:gap-6">

                    {/* Icon */}
                    <div className="shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                      <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-orange-500" />
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">

                      <div className="flex flex-wrap items-center gap-2 mb-2">

                        <h2 className="font-black text-base sm:text-lg text-white truncate">
                          {getAuctionTitle(auction)}
                        </h2>

                        <span className="px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] sm:text-xs font-bold uppercase">
                          {getAuctionType(auction)}
                        </span>

                      </div>

                      <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500">
                        <Calendar className="w-4 h-4 shrink-0" />
                        <span>
                          {formatDate(
                            auction?.completed_at ||
                            auction?.updated_at ||
                            auction?.created_at
                          )}
                        </span>
                      </div>

                    </div>

                    {/* Arrow */}
                    <div className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center group-hover:bg-orange-500 group-hover:border-orange-500 transition-all">
                      <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-black transition-colors" />
                    </div>

                  </div>

                </div>
              </motion.button>
            ))}

          </div>
        )}

      </main>
    </div>
  )
}

export default History