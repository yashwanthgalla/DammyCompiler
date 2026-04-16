import type { VercelRequest, VercelResponse } from '@vercel/node'

const LANGUAGE_ID_TO_COMPILER = {
  4: 'gcc-15',           // C
  10: 'g++-15',          // C++
  26: 'openjdk-25',      // Java
  51: 'dotnet-csharp-9', // C#
  60: 'go',              // Go
  63: 'typescript-deno',  // JavaScript
  68: 'php',             // PHP
  71: 'python-3.14',     // Python
  72: 'ruby',            // Ruby
  73: 'rust',            // Rust
  78: 'kotlin',          // Kotlin
  80: 'r',               // R
  83: 'swift',           // Swift
  84: 'typescript-deno',  // TypeScript
  85: 'perl',            // Perl
  86: 'scala',           // Scala
}

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
    provider: 'onlinecompiler',
    languages: Object.entries(LANGUAGE_ID_TO_COMPILER).map(([id, value]) => ({
      id: Number(id),
      compiler: value,
    })),
  })
}
