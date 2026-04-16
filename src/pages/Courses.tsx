import { ComingSoon } from '../components/ComingSoon'
import { PlatformShell } from '../components/PlatformShell'
import { BookOpen } from 'lucide-react'

export const Courses = () => {
  return (
    <PlatformShell>
      <ComingSoon 
        title="Interactive Courses" 
        description="We are crafting immersive learning paths for DSA, Web Development, and more. Master coding with hands-on projects and expert-led curriculum."
        icon={<BookOpen size={40} />}
      />
    </PlatformShell>
  )
}
