import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { BookOpen } from 'lucide-react'
import React, { memo } from 'react'

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
                <div className="flex flex-col gap-4 animate-pulse pt-2">
                    <div className="h-8 bg-[var(--color-surface-2)] rounded-md w-3/4 max-w-[400px]" />
                    <div className="space-y-2.5">
                        <div className="h-4 bg-[var(--color-surface-2)] rounded w-full" />
                        <div className="h-4 bg-[var(--color-surface-2)] rounded w-11/12" />
                        <div className="h-4 bg-[var(--color-surface-2)] rounded w-5/6" />
                    </div>
                    <div className="h-32 bg-[var(--color-surface-2)] rounded-lg w-full mt-4" />
                    <div className="space-y-2.5 mt-4">
                        <div className="h-4 bg-[var(--color-surface-2)] rounded w-full" />
                        <div className="h-4 bg-[var(--color-surface-2)] rounded w-4/5" />
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
                                    <img
                                        className="max-w-full h-auto inline-block align-middle rounded-md border border-[var(--color-border)] opacity-0 transition-opacity duration-300"
                                        loading="lazy"
                                        onLoad={(e) => e.currentTarget.classList.remove('opacity-0')}
                                        {...props}
                                        src={src}
                                    />
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
