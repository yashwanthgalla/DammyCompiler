import type { VercelRequest, VercelResponse } from '@vercel/node'

const ONLINECOMPILER_BASE_URL =
  (process.env.ONLINECOMPILER_BASE_URL || 'https://api.onlinecompiler.io').trim().replace(/\/$/, '')
const ONLINECOMPILER_EXECUTE_PATH = (process.env.ONLINECOMPILER_EXECUTE_PATH || '/api/run-code-sync/').trim()
const ONLINECOMPILER_API_KEY = (process.env.ONLINECOMPILER_API_KEY || '').trim()

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  res.json({
    status: 'ok',
    message: 'Compiler API is running on Vercel',
    provider: 'onlinecompiler',
    onlineCompilerConfigured: Boolean(ONLINECOMPILER_API_KEY),
    baseUrl: ONLINECOMPILER_BASE_URL,
    executePath: ONLINECOMPILER_EXECUTE_PATH,
  })
}
