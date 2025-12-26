#!/usr/bin/env node
/*
This script previously uploaded videos to YouTube; that behavior has been deprecated.

YouTube upload automation has been removed from this project. To enqueue remote URLs
for download and processing, use the Supabase Edge Function `add-ad` or POST to
`/api/upload-remote-video` with header `x-auth-token: <AUTH_TOKEN>` and body `{ url }`.

If you want a helper to download a list of URLs to ./videos for manual work, add a
small utility script that reads a file of URLs and either downloads them locally or
calls the enqueue API. This repo no longer performs automated uploads to YouTube.
*/

console.log('This repository no longer supports automated YouTube uploads. Exiting.')
process.exit(0)

