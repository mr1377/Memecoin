import { Link } from 'react-router-dom'
import { Page } from '../components/Layout'
import NerdAvatar from '../components/NerdAvatar'
import { MASCOT } from '../components/Mascot'

export default function NotFound() {
  return (
    <Page className="mx-auto flex max-w-lg flex-col items-center px-4 pt-16 text-center">
      <div className="h-48 w-48 animate-float">
        <NerdAvatar seed={MASCOT} mood="shock" bg={false} className="h-full w-full" />
      </div>
      <p className="mt-6 font-mono text-sm text-carrot">ERROR 404</p>
      <h1 className="mt-2 text-4xl font-extrabold">This nerd moved out.</h1>
      <p className="mt-3 text-white/60">The page (or profile) you’re looking for doesn’t exist. Even our search algorithm got rejected.</p>
      <Link to="/explore" className="btn-primary mt-8">Back to Explore</Link>
    </Page>
  )
}
