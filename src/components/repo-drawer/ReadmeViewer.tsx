import React, { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { BookOpen, Loader2 } from 'lucide-react'
import { Skeleton } from '../ui/Skeleton'

interface ReadmeViewerProps {
    loading: boolean
    readme: string | null
    title: React.ReactNode
    drawerTheme: string
    repoUrl: string
    baseUrls: { rawBase: string, blobBase: string } | null
}

export const ReadmeViewer = memo(function ReadmeViewer({
    loading,
    readme,
    title,
    drawerTheme,
    repoUrl,
    baseUrls
}: ReadmeViewerProps) {
    const isErrorState = readme === 'No README found.' || readme === 'Failed to load README / Profile data.' || !readme

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-[var(--color-border)] m-0">
                {title}
            </h3>

            {loading ? (
                <div className="flex flex-col gap-6 pt-2">
                    <div className="space-y-3">
                        <Skeleton className="h-8 w-3/4 max-w-[400px]" />
                        <Skeleton className="h-4 w-1/2 max-w-[200px]" />
                    </div>
                    <div className="space-y-3">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-[92%]" />
                        <Skeleton className="h-4 w-[85%]" />
                    </div>
                    <Skeleton className="h-[200px] w-full rounded-xl" />
                    <div className="space-y-3">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-[80%]" />
                    </div>
                </div>
            ) : isErrorState ? (
                <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-[var(--color-border)] rounded-xl bg-[var(--color-surface-2)] mt-4">
                    <BookOpen className="h-10 w-10 text-[var(--color-text-muted)] mb-3" />
                    <p className="text-[var(--color-text)] font-medium mb-1">Unable to load README</p>
                    <p className="text-sm text-[var(--color-text-subtle)] mb-4">This could be due to a network issue, or this repository doesn't have a README file.</p>
                    <a
                        href={`${repoUrl}#readme`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        View on GitHub
                    </a>
                </div>
            ) : (
                <div className={`prose prose-sm max-w-none
                    ${drawerTheme === 'dark' ? 'prose-invert' : ''}
                    prose-headings:text-[var(--color-text)] 
                    prose-p:text-[var(--color-text-subtle)]
                    prose-a:text-[var(--color-accent)] hover:prose-a:text-[var(--color-accent-hover)]
                    prose-code:text-[var(--color-accent)] prose-code:bg-[var(--color-surface-2)] prose-code:px-1 prose-code:rounded
                    prose-pre:bg-[var(--color-surface-2)] prose-pre:border prose-pre:border-[var(--color-border)]
                    prose-img:rounded-lg prose-img:border prose-img:border-[var(--color-border)]
                    [&_p_img]:inline-block [&_p_img]:my-0 [&_p_img]:mx-1
                    [&_p_a_img]:inline-block [&_p_a_img]:my-0
                `}>
                    <ReactMarkdown
                        rehypePlugins={[
                            rehypeRaw,
                            [rehypeSanitize, {
                                ...defaultSchema,
                                tagNames: defaultSchema.tagNames?.filter(t => !['script', 'style', 'iframe', 'object', 'embed'].includes(t)),
                                attributes: {
                                    ...defaultSchema.attributes,
                                    '*': [...(defaultSchema.attributes?.['*'] || []), 'className'],
                                }
                            }]
                        ]}
                        remarkPlugins={[remarkGfm]}
                        components={{
                            img: ({ node: _node, ...props }) => {
                                let src = props.src;
                                if (src && baseUrls && !src.startsWith('http') && !src.startsWith('data:') && !src.startsWith('#')) {
                                    src = `${baseUrls.rawBase}${src.replace(/^\.\//, '')}`;
                                }

                                return (
                                    <span className="relative inline-block my-2 max-w-full group/readme-img min-h-[40px] min-w-[40px]">
                                        {/* Loading Spinner - Uses a data attribute to keep track of state locally */}
                                        <span 
                                            className="absolute inset-0 flex items-center justify-center bg-[var(--color-surface-2)]/50 rounded-md transition-opacity duration-300 pointer-events-none"
                                            id={`spinner-${src}`}
                                        >
                                            <Loader2 className="h-5 w-5 animate-spin text-[var(--color-text-muted)]" />
                                        </span>
                                        
                                        <img
                                            className="max-w-full h-auto inline-block align-middle rounded-md border border-[var(--color-border)] opacity-0 transition-opacity duration-500"
                                            loading="lazy"
                                            decoding="async"
                                            onLoad={(e) => {
                                                e.currentTarget.classList.remove('opacity-0');
                                                const spinner = document.getElementById(`spinner-${src}`);
                                                if (spinner) spinner.style.opacity = '0';
                                            }}
                                            onError={(e) => {
                                                const target = e.currentTarget;
                                                const retryCount = parseInt(target.getAttribute('data-retry') || '0');
                                                
                                                if (retryCount < 2) {
                                                    // Simple retry logic: append a timestamp to bust any cache/stalls
                                                    setTimeout(() => {
                                                        target.setAttribute('data-retry', (retryCount + 1).toString());
                                                        const originalSrc = src || '';
                                                        const separator = originalSrc.includes('?') ? '&' : '?';
                                                        target.src = `${originalSrc}${separator}retry=${retryCount + 1}`;
                                                    }, 1000); // Wait 1s before retrying
                                                } else {
                                                    target.style.display = 'none';
                                                    const spinner = document.getElementById(`spinner-${src}`);
                                                    if (spinner) spinner.style.display = 'none';
                                                }
                                            }}
                                            {...props}
                                            src={src}
                                        />
                                    </span>
                                );
                            },
                            a: ({ node: _node, ...props }) => {
                                let href = props.href;
                                if (href && baseUrls && !href.startsWith('http') && !href.startsWith('mailto:') && !href.startsWith('data:') && !href.startsWith('#')) {
                                    href = `${baseUrls.blobBase}${href.replace(/^\.\//, '')}`;
                                }
                                return <a {...props} href={href} target="_blank" rel="noopener noreferrer" />;
                            }
                        }}
                    >
                        {readme || ''}
                    </ReactMarkdown>
                </div>
            )}
        </div>
    )
})
