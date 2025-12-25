/**
 * Job processor for Ad Library
 * - Run this script from a scheduler (cron, GitHub Actions, or a long-running worker) to
 *   process active AdJob entries in the database.
 *
 * Behavior:
 * - REPOST: create a new Ad record copying the sourceUrl/metadata to "repost" the ad
 * - REFRESH: re-fetch metadata via oEmbed/YouTube and update the existing Ad
 *
 * Usage:
 *   npx ts-node src/server/processAdJobs.ts
 * Or schedule via cron or GitHub Actions
 */

// @ts-expect-error: Prisma client types are generated at build time
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function refreshMetadata(adId: string) {
  const ad = await prisma.ad.findUnique({ where: { id: adId } })
  if (!ad) return

  try {
    const url = new URL(ad.sourceUrl)
    // Try oEmbed / noembed
    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
      // Use oEmbed first
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(ad.sourceUrl)}&format=json`
      const r = await fetch(oembedUrl)
      if (r.ok) {
        const d = await r.json()
        await prisma.ad.update({ where: { id: ad.id }, data: { title: d.title ?? ad.title, description: d.author_name ? `By ${d.author_name}` : ad.description, thumbnail: d.thumbnail_url ?? ad.thumbnail } })
        return
      }
      // Fallback: if YOUTUBE_API_KEY available, call YouTube Data API
      const key = process.env.YOUTUBE_API_KEY
      if (key) {
        let videoId = ''
        if (url.hostname.includes('youtu.be')) videoId = url.pathname.slice(1)
        else videoId = url.searchParams.get('v') || ''
        if (videoId) {
          const apiUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
          apiUrl.searchParams.set('key', key)
          apiUrl.searchParams.set('part', 'snippet,contentDetails')
          apiUrl.searchParams.set('id', videoId)
          const yres = await fetch(apiUrl.toString())
          if (yres.ok) {
            const jd = await yres.json()
            const it = jd.items?.[0]
            if (it) {
              await prisma.ad.update({ where: { id: ad.id }, data: { title: it.snippet?.title ?? ad.title, description: it.snippet?.description ?? ad.description, thumbnail: it.snippet?.thumbnails?.medium?.url ?? ad.thumbnail } })
              return
            }
          }
        }
      }
    } else {
      // Generic noembed
      const oe = `https://noembed.com/embed?url=${encodeURIComponent(ad.sourceUrl)}`
      const r = await fetch(oe)
      if (r.ok) {
        const d = await r.json()
        await prisma.ad.update({ where: { id: ad.id }, data: { title: d.title ?? ad.title, description: d.author_name ? `By ${d.author_name}` : ad.description, thumbnail: d.thumbnail_url ?? ad.thumbnail } })
        return
      }
    }
  } catch (err) {
    console.error('refreshMetadata error for', adId, err)
  }
}

async function repostAd(adId: string) {
  const ad = await prisma.ad.findUnique({ where: { id: adId } })
  if (!ad) return

  await prisma.ad.create({ data: {
    title: ad.title,
    description: ad.description,
    platform: ad.platform,
    industry: ad.industry,
    hookType: ad.hookType,
    ctaType: ad.ctaType,
    sourceUrl: ad.sourceUrl,
    sourceType: 'USER_URL',
    originalOwner: ad.originalOwner,
    published: true,
    thumbnail: ad.thumbnail,
    durationSec: ad.durationSec,
  }})
}

async function processJobs() {
  console.log('Processing AdJobs...')
  const jobs = await prisma.adJob.findMany({ where: { active: true } })
  const now = new Date()
  for (const job of jobs) {
    const shouldRun = !job.lastRunAt || (now.getTime() - job.lastRunAt.getTime()) >= job.intervalMin * 60 * 1000
    if (!shouldRun) continue
    try {
      console.log('Running job', job.id, job.type, 'for ad', job.adId)
      if (job.type === 'REFRESH') await refreshMetadata(job.adId)
      else if (job.type === 'REPOST') await repostAd(job.adId)
      await prisma.adJob.update({ where: { id: job.id }, data: { lastRunAt: new Date() } })
    } catch (err) {
      console.error('Error processing job', job.id, err)
    }
  }
}

processJobs()
  .catch((err) => { console.error('processAdJobs error', err) })
  .finally(() => prisma.$disconnect())
