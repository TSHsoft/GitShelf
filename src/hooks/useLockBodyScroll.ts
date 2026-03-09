import { useLayoutEffect } from 'react'

let scrollLocks = 0
let originalOverflow = ''
let originalPadding = ''

export function useLockBodyScroll(isLocked: boolean = true) {
    useLayoutEffect(() => {
        if (!isLocked) return

        if (scrollLocks === 0) {
            originalOverflow = document.body.style.overflow
            originalPadding = document.body.style.paddingRight

            const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
            if (scrollbarWidth > 0) {
                document.body.style.paddingRight = `calc(${originalPadding || '0px'} + ${scrollbarWidth}px)`
            }
            document.body.style.overflow = 'hidden'
        }

        scrollLocks++

        return () => {
            scrollLocks--
            if (scrollLocks === 0) {
                document.body.style.overflow = originalOverflow
                document.body.style.paddingRight = originalPadding
            }
        }
    }, [isLocked])
}
