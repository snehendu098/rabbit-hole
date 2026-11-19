import { Suspense } from 'react'
import { Frame } from '@/components/ds'
import { AppNav, stage } from '@/components/map'
import Explore from './explore'

export default function Page() {
  return (
    <Frame nav={<AppNav />}>
      {/* search params → client only */}
      <Suspense fallback={<div className={`${stage} pc-dots`} />}>
        <Explore />
      </Suspense>
    </Frame>
  )
}
