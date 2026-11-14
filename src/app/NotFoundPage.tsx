import { Link } from 'react-router-dom'
import { EmptyState } from '../ui'

export function NotFoundPage() {
  return (
    <>
      <h1>Page not found</h1>
      <EmptyState
        title="This page does not exist"
        description="Check the address or return to the dashboard."
        action={<Link to="/">Go to Dashboard</Link>}
      />
    </>
  )
}
