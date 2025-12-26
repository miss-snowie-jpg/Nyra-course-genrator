/*
 Service: fetchAdVideos
 - Fetches ad video metadata from configurable online sources (YouTube RSS, public feeds)
 - Normalizes metadata and upserts into the Prisma `Ad` table
 - This file is written as a service used by cron jobs or serverless functions

 Design choices:
 - Keep source fetchers modular so new adapters (TikTok, Meta) can be added later.
 - Use upsert semantics to avoid duplicate ads.
 - Avoid downloading large video assets here; just store source URL and thumbnail.

 TODO: wire this into your runtime (cron, supabase function, or server endpoint).
*/

import { PrismaClient, Platform } from '@prisma/client'
import fetch from 'node-fetch'

const prisma = new PrismaClient()

type AdSource = {
  id: string
  title: string
  description?: string
  platform: Platform
  industry?: string
  hookType?: string
  ctaType?: string
  sourceUrl: string
  thumbnail?: string
  durationSec?: number
  tags?: string[]
}

// Example lightweight YouTube RSS parser (fetches feed and parses items)
async function fetchYouTubeChannelFeed(rssUrl: string): Promise<AdSource[]> {
  const res = await fetch(rssUrl)
  const text = await res.text()
  // Quick-and-dirty XML parsing using regex for demo; replace with robust parser in production
  const items = Array.from(text.matchAll(/<entry>[\s\S]*?<id>(.*?)<\/id>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<media:group>[\s\S]*?<media:thumbnail url=\\"(.*?)\\"[\s\S]*?<yt:duration seconds=\\"(\\d+)\\"[\s\S]*?<media:description>([\s\S]*?)<\/media:description>[\s\S]*?<\/media:group>[\s\S]*?<link rel=\\"alternate\\" href=\\"(.*?)\\"[\s\S]*?<\/entry>/g))
  const ads: AdSource[] = items.map((m) => ({
    id: m[1],
    title: m[2],
    thumbnail: m[3],
    durationSec: parseInt(m[4] || '0', 10),
    description: m[5],
    sourceUrl: m[6],
    platform: Platform.YOUTUBE,
  }))
  return ads
}

// Normalize and upsert array of AdSource into DB
export async function fetchAdVideos(maxPerRun = 6): Promise<void> {
  // Load sources from config file (repo-level JSON); fallback to YouTube RSS example
  let sources: string[] = []
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cfg = require('./ad-sources.json')
    sources = cfg?.sources || []
  } catch (e) {
    sources = ['https://www.youtube.com/feeds/videos.xml?channel_id=UC4R8DWoMoI7CAwX8_LjQHig']
  }

  // Collect candidate items from all sources
  const candidates: AdSource[] = []
  for (const src of sources) {
    try {
      if (src.includes('youtube.com') || src.includes('youtu.be')) {
        const items = await fetchYouTubeChannelFeed(src)
        candidates.push(...items)
      } else {
        // Try generic RSS/JSON feed parser (basic)
        try {
          const res = await fetch(src)
          if (!res.ok) continue
          const text = await res.text()
          // try simple JSON array
          try {
            const j = JSON.parse(text)
            if (Array.isArray(j)) {
              for (const it of j) {
                if (it?.url) {
                  candidates.push({
                    id: it.id || it.url,
                    title: it.title || it.name || 'Untitled',
                    description: it.description || '',
                    platform: Platform.META,
                    sourceUrl: it.url,
                    thumbnail: it.thumbnail || null,
                    durationSec: it.duration || it.durationSec || null,
                  })
                }
              }
            }
          } catch (_) {
            // Basic RSS parsing: find <item> with enclosure url or link
            const items = Array.from(text.matchAll(/<item>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?(?:<enclosure [^>]*url=\"(.*?)\"[^>]*>)?/g))
            for (const m of items) {
              const link = m[1]
              const title = m[2]
              const enclosure = m[3]
              const url = enclosure || link
              if (url) {
                candidates.push({
                  id: url,
                  title: title || 'Untitled',
                  description: '',
                  platform: Platform.TIKTOK,
                  sourceUrl: url,
                })
              }
            }
          }
        } catch (e) {
          // ignore source errors
          console.error('Failed to fetch generic source', src, e)
        }
      }
    } catch (err) {
      console.error('Error fetching source', src, err)
    }
  }

  // Deduplicate and prefer short videos (≤10s) where duration available
  // Query existing sourceUrls
  const sourceUrls = candidates.map((c) => c.sourceUrl)
  const existing = await prisma.ad.findMany({ where: { sourceUrl: { in: sourceUrls } }, select: { sourceUrl: true } })
  const existingSet = new Set(existing.map((e) => e.sourceUrl))

  const newCandidates = candidates.filter((c) => !existingSet.has(c.sourceUrl))

  // sort: prefer shorter duration and then any order
  newCandidates.sort((a, b) => ( (a.durationSec || 999) - (b.durationSec || 999) ))

  const toInsert = newCandidates.slice(0, maxPerRun)

  for (const item of toInsert) {
    try {
      const tagRecords: { id: string }[] = []
      if (item.tags?.length) {
        for (const t of item.tags) {
          const tag = await prisma.tag.upsert({ where: { name: t }, update: {}, create: { name: t } })
          tagRecords.push({ id: tag.id })
        }
      }

      try {
        const created = await prisma.ad.create({
          data: {
            title: item.title,
            description: item.description || null,
            thumbnail: item.thumbnail || null,
            durationSec: item.durationSec || null,
            platform: item.platform,
            sourceUrl: item.sourceUrl,
            sourceType: 'AUTO',
            published: true,
            tags: { connect: tagRecords },
          }
        })
        console.log('Inserted ad', item.title)

        // Enqueue remote download for processing (worker will fetch, transcode, and update Ad)
        await prisma.adUpload.create({ data: { adId: created.id, storagePath: item.sourceUrl, filename: item.title || null, remote: true } })
      } catch (e) {
        console.error('Failed to insert candidate', item, e)
      }
    } catch (e) {
      console.error('Failed to insert candidate', item, e)
    }
  }

  await prisma.$disconnect()
}

// Example usage: run from a cron job or serverless function
// (async () => { await fetchAdVideos() })()
