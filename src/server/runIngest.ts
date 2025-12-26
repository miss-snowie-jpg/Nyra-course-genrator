import { fetchAdVideos } from './fetchAdVideos'

async function main() {
  try {
    console.log('Running daily ingest (limit 6)')
    await fetchAdVideos(6)
    console.log('Ingest completed')
  } catch (e) {
    console.error('Ingest failed', e)
    process.exit(1)
  }
}

if (require.main === module) main()
