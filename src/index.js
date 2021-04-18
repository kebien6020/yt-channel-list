require('dotenv').config()
const API_KEY = process.env.API_KEY


const { google } = require('googleapis')
const zip = require('lodash.zip')
const { toSeconds, parse } = require('iso8601-duration')

const yt = google.youtube({version: 'v3', auth: API_KEY})
const FINISHED = Symbol('FINISHED')

const main = async () => {
  if (!API_KEY) {
    throw new Error('API_KEY not configured in .env file')
  }

  const maxPages = Number(process.argv[2] ?? 2)
  const perPage = Number(process.argv[3] ?? 10)

  let nextPageToken = undefined
  let allVideos = []

  for (let page = 0; page < maxPages && nextPageToken !== FINISHED; ++page) {
    const res = await yt.search.list({
      part: 'snippet',
      channelId: 'UCm9K6rby98W8JigLoZOh6FQ',
      order: 'date',
      pageToken: nextPageToken,
      maxResults: perPage,
    })

    const results = res.data.items

    const { resultsPerPage, totalResults } = res.data.pageInfo
    const totalPages = Math.floor(totalResults / resultsPerPage)
    nextPageToken = res.data.nextPageToken
    if (nextPageToken === undefined) nextPageToken = FINISHED

    const res2 = await yt.videos.list({
      part: 'contentDetails',
      id: results.map(r => r.id.videoId).join(','),
    })

    const details = res2.data.items

    const videos = zip(results, details).map(([result, detail]) => ({
      id: result.id.videoId,
      title: result.snippet.title,
      durationSeconds: toSeconds(parse(detail.contentDetails.duration)),
    }))

    allVideos.push(...videos)
    console.log(`Page ${page + 1} out of ${totalPages}, next: ${String(nextPageToken)}`)
  }

  allVideos
    .sort((a, b) => b.durationSeconds - a.durationSeconds)
    .map(videoText)
    .forEach(line => console.log(line))
}

const videoText = video => {
  const { durationSeconds, id, title } = video
  const url = `https://youtube.com/watch?v=${id}`
  const hours = Math.floor(durationSeconds / 3600)
  const minutes = Math.floor(durationSeconds / 60) % 60
  const seconds = durationSeconds % 60
  const pad = n => String(n).padStart(2, '0')
  const duration = (hours > 0 ? `${pad(hours)}:` : '') + `${pad(minutes)}:${pad(seconds)}`

  return `[${duration}] ${title} - ${url}`
}

exports.main = main;

if (require.main === module) {
  main().catch(error => {
    console.log(error.message)
    process.exit(1)
  })
}
