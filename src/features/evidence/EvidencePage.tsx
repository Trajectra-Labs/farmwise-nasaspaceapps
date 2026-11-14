import { EmptyState } from '../../ui'

/** Placeholder - owned by Ted. No NASA data is shown until a real, traceable snapshot is added. */
export function EvidencePage() {
  return (
    <>
      <h1>Data &amp; Evidence</h1>
      <EmptyState
        title="NASA POWER snapshot not loaded yet"
        description="Placeholder - owned by Ted. No climate numbers are shown until a real, traceable snapshot is added."
      />
    </>
  )
}
