import { Button } from "@/components/ui/button"
import { IconFolderCode } from "@tabler/icons-react"
import { Upload } from "lucide-react"
import './EmptyDemo.css'

interface EmptyDemoProps {
  onCreateProject?: () => void
  onImportProject?: () => void
}

export function EmptyDemo({ onCreateProject, onImportProject }: EmptyDemoProps) {
  return (
    <section className="workspace-empty" aria-label="Empty workspace state">
      <IconFolderCode size={40} className="workspace-empty-icon" aria-hidden="true" />
      <h2 className="workspace-empty-title">No Projects Yet</h2>
      <p className="workspace-empty-description">
        Create your first project to start building.
      </p>
      <div className="empty-actions-row">
        <Button onClick={onCreateProject} className="empty-action-btn empty-action-btn-primary">
          <span>Create Project</span>
        </Button>
        <Button variant="outline" onClick={onImportProject} className="empty-action-btn empty-action-btn-ghost">
          <Upload size={15} aria-hidden="true" />
          <span>Import Project</span>
        </Button>
      </div>
    </section>
  )
}

