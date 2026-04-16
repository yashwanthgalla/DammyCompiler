import { ComingSoon } from '../components/ComingSoon'
import { PlatformShell } from '../components/PlatformShell'
import { Trophy } from 'lucide-react'

export const Contests = () => {
  return (
    <PlatformShell>
      <ComingSoon 
        title="Live Coding Contests" 
        description="Get ready to showcase your skills in our upcoming weekly and bi-weekly competitive coding arena. Earn ranks, win prizes, and climb the global leaderboard."
        icon={<Trophy size={40} />}
      />
    </PlatformShell>
  )
}
