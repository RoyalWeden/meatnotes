import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import readingTime from "reading-time"
import { classNames } from "../util/lang"
import { JSX } from "preact"
import style from "./styles/contentMeta.scss"

interface ContentMetaOptions {
  showReadingTime: boolean
  showComma: boolean
}

const defaultOptions: ContentMetaOptions = {
  showReadingTime: true,
  showComma: true,
}

function formatRelative(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffWeeks < 5) return `${diffWeeks}w ago`
  if (diffMonths < 12) return `${diffMonths}mo ago`
  return `${diffYears}y ago`
}

function formatExact(date: Date): string {
  return date.toLocaleString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatCreated(date: Date): string {
  return date.toLocaleString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default ((opts?: Partial<ContentMetaOptions>) => {
  const options: ContentMetaOptions = { ...defaultOptions, ...opts }

  function ContentMetadata({ cfg, fileData, displayClass }: QuartzComponentProps) {
    const text = fileData.text
    if (!text) return null

    const segments: (string | JSX.Element)[] = []

    const created = fileData.dates?.created
    const modified = fileData.dates?.modified

    if (created) {
      segments.push(
        <span class="meta-created" data-date-iso={created.toISOString()} data-tooltip={formatExact(created)}>
          {formatCreated(created)}
        </span>
      )
    }

    if (modified) {
      segments.push(
        <span class="meta-modified" data-date-iso={modified.toISOString()} data-tooltip={formatExact(modified)}>
          updated {formatRelative(modified)}
        </span>
      )
    }

    if (options.showReadingTime) {
      const { minutes } = readingTime(text)
      segments.push(<span>{Math.ceil(minutes)} min read</span>)
    }

    const joined: (string | JSX.Element)[] = []
    segments.forEach((seg, i) => {
      joined.push(seg)
      if (i < segments.length - 1) joined.push(<span class="meta-sep"> · </span>)
    })

    return (
      <p show-comma={false} class={classNames(displayClass, "content-meta")}>
        {joined}
      </p>
    )
  }

  ContentMetadata.css = style + `
    .meta-created, .meta-modified {
      cursor: help;
      border-bottom: 1px dotted var(--gray);
      position: relative;
    }
    .meta-created:hover, .meta-modified:hover {
      color: var(--dark);
    }
    .meta-sep {
      color: var(--gray);
    }
    .meta-created::after, .meta-modified::after {
      content: attr(data-tooltip);
      position: absolute;
      bottom: calc(100% + 6px);
      left: 50%;
      transform: translateX(-50%);
      background: var(--light);
      color: var(--dark);
      border: 1px solid var(--lightgray);
      border-radius: 6px;
      padding: 0.4rem 0.75rem;
      font-size: 0.85rem;
      font-family: inherit;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.12);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.15s ease;
      z-index: 100;
    }
    .meta-created:hover::after, .meta-modified:hover::after {
      opacity: 1;
    }
  `

  ContentMetadata.afterDOMLoaded = `
    (function() {
      function relativeTime(date) {
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMins / 60)
        const diffDays = Math.floor(diffHours / 24)
        const diffWeeks = Math.floor(diffDays / 7)
        const diffMonths = Math.floor(diffDays / 30)
        const diffYears = Math.floor(diffDays / 365)
        if (diffMins < 1) return "just now"
        if (diffMins < 60) return diffMins + "m ago"
        if (diffHours < 24) return diffHours + "h ago"
        if (diffDays < 7) return diffDays + "d ago"
        if (diffWeeks < 5) return diffWeeks + "w ago"
        if (diffMonths < 12) return diffMonths + "mo ago"
        return diffYears + "y ago"
      }

      function updateCreatedDate() {
        const el = document.querySelector('.meta-created')
        if (!el) return
        const iso = el.getAttribute('data-date-iso')
        if (!iso) return
        const date = new Date(iso)
        if (isNaN(date.getTime())) return
        el.textContent = date.toLocaleString('en-AU', { year: 'numeric', month: 'short', day: 'numeric' })
        el.setAttribute('data-tooltip', date.toLocaleString('en-AU', {
          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }))
      }

      function updateMeta() {
        const el = document.querySelector('.meta-modified')
        if (!el) return
        const iso = el.getAttribute('data-date-iso')
        if (!iso) return
        const date = new Date(iso)
        if (isNaN(date.getTime())) return
        el.textContent = "updated " + relativeTime(date)
        el.setAttribute('data-tooltip', date.toLocaleString('en-AU', {
          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }))
      }

      updateCreatedDate()
      updateMeta()
      setInterval(updateMeta, 60000)
      document.addEventListener('nav', updateCreatedDate)
      document.addEventListener('nav', updateMeta)
    })()
    `

  return ContentMetadata
}) satisfies QuartzComponentConstructor