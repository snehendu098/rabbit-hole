import { Suspense } from 'react'
import { Frame } from '@/components/ds'
import { AppNav } from '@/components/map'
import IssueView from './issue'

export default function Page() {
  return (
    <Frame nav={<AppNav />}>
      <Suspense fallback={null}>
        <IssueView />
      </Suspense>
    </Frame>
  )
}
