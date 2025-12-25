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
export async function fetchAdVideos(): Promise<void> {
  // Sources can be extended. Currently demonstrates a YouTube RSS channel fetch.
  const sources = [
    // Example: YouTube channel RSS (replace with curated ad channels or playlists)
    'https://www.youtube.com/feeds/videos.xml?channel_id=UC4R8DWoMoI7CAwX8_LjQHig',
  ]

  for (const src of sources) {
    try {
      const items = await fetchYouTubeChannelFeed(src)
      for (const item of items) {
        // Upsert tags and ad record
        const tagRecords = [] as { id: string }[]
        if (item.tags?.length) {
          for (const t of item.tags) {
            const tag = await prisma.tag.upsert({
              where: { name: t },
              update: {},
              create: { name: t },
            })
            tagRecords.push({ id: tag.id })
          }
        }

        // Upsert Ad by sourceUrl
        await prisma.ad.upsert({
          where: { sourceUrl: item.sourceUrl },
          update: {
            title: item.title,
            description: item.description,
            thumbnail: item.thumbnail,
            durationSec: item.durationSec,
            platform: item.platform,
            industry: item.industry,
          },
          create: {
            title: item.title,
            description: item.description,
            thumbnail: item.thumbnail,
            durationSec: item.durationSec,
            platform: item.platform,
            industry: item.industry,
            sourceUrl: item.sourceUrl,
            tags: { connect: tagRecords },
          },
        })
      }
    } catch (err) {
      // Log and continue; ingestion should be resilient
      // In production, use structured logging and retry/backoff
      // eslint-disable-next-line no-console
      console.error('Error fetching source', src, err)
    }
  }

  await prisma.$disconnect()
}

// Example usage: run from a cron job or serverless function
// (async () => { await fetchAdVideos() })()
