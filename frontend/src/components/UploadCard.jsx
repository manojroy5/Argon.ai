import { ArrowClockwise } from '@phosphor-icons/react/ArrowClockwise'
import { CheckCircle } from '@phosphor-icons/react/CheckCircle'
import { ImageSquare } from '@phosphor-icons/react/ImageSquare'
import { SpinnerGap } from '@phosphor-icons/react/SpinnerGap'
import { Trash } from '@phosphor-icons/react/Trash'
import { WarningCircle } from '@phosphor-icons/react/WarningCircle'
import { useState } from 'react'

const STATUS_LABELS = {
  validating: 'Validating',
  ready: 'Ready',
  uploading: 'Uploading',
  processing: 'Checking quality',
  accepted: 'Accepted',
  rejected: 'Needs attention',
  failed: 'Upload failed',
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function Preview({ upload, previewFailed, onPreviewError }) {
  if (previewFailed) {
    return <span className="preview-fallback"><ImageSquare size={28} weight="duotone" /></span>
  }

  return (
    <img
      className="preview-image"
      src={upload.previewUrl}
      alt={`Preview of ${upload.fileName}`}
      onError={onPreviewError}
    />
  )
}

function UploadCard({ upload, onRemove, onRetry, variant = 'gallery' }) {
  const [previewFailed, setPreviewFailed] = useState(false)
  const isActive = ['validating', 'ready', 'uploading', 'processing'].includes(upload.status)
  const canRetry = upload.status === 'failed'

  if (variant === 'compact') {
    return (
      <li className="upload-card compact-card">
        <div className="compact-preview">
          <Preview upload={upload} previewFailed={previewFailed} onPreviewError={() => setPreviewFailed(true)} />
        </div>
        <div className="compact-details">
          <p className="file-name" title={upload.fileName}>{upload.fileName}</p>
          <p className="file-meta">{STATUS_LABELS[upload.status]} · {formatBytes(upload.file.size)}</p>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${upload.progress}%` }} /></div>
        </div>
        <SpinnerGap className="spin" size={18} weight="bold" aria-label="Processing" />
      </li>
    )
  }

  const StatusIcon = upload.status === 'accepted' ? CheckCircle : WarningCircle

  return (
    <li className={`upload-card gallery-card ${upload.status}`}>
      <div className="gallery-preview">
        <Preview upload={upload} previewFailed={previewFailed} onPreviewError={() => setPreviewFailed(true)} />
        <button className="delete-button" type="button" onClick={() => onRemove(upload.id)} aria-label={`Remove ${upload.fileName}`}>
          <Trash size={17} weight="bold" />
        </button>
        {isActive ? <span className="processing-overlay"><SpinnerGap className="spin" size={24} /></span> : null}
      </div>
      <div className="gallery-card-copy">
        <p className="file-name" title={upload.fileName}>{upload.fileName}</p>
        <div className={`gallery-status ${upload.status}`}>
          <StatusIcon size={15} weight="fill" />
          <span>{upload.rejectionReasons[0] || STATUS_LABELS[upload.status]}</span>
        </div>
        {upload.rejectionReasons.slice(1).map((reason) => <p className="extra-reason" key={reason}>{reason}</p>)}
        {canRetry && onRetry ? (
          <button className="retry-button" type="button" onClick={() => onRetry(upload.id)}>
            <ArrowClockwise size={15} weight="bold" /> Retry upload
          </button>
        ) : null}
      </div>
    </li>
  )
}

export default UploadCard
