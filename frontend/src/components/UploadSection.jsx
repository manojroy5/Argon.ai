import UploadCard from './UploadCard.jsx'

function UploadSection({
  title,
  description,
  uploads,
  tone,
  variant = 'gallery',
  emptyMessage,
  onRemove,
  onRetry,
  onClear,
}) {
  return (
    <section className={`upload-section ${tone} ${variant}`} aria-labelledby={`${tone}-${variant}-heading`}>
      <header className="section-header">
        <div>
          <div className="section-title-row">
            <h2 id={`${tone}-${variant}-heading`}>{title}</h2>
            <span className="count-badge" aria-label={`${uploads.length} items`}>{uploads.length}</span>
          </div>
          <p className="section-description">{description}</p>
        </div>
        {uploads.length > 0 && onClear ? (
          <button className="text-button" type="button" onClick={onClear}>Clear all</button>
        ) : null}
      </header>
      <div className="section-content">
        {uploads.length === 0 ? (
          <div className="empty-state">{emptyMessage}</div>
        ) : (
          <ul className="upload-list">
            {uploads.map((upload) => (
              <UploadCard
                key={upload.id}
                upload={upload}
                onRemove={onRemove}
                onRetry={onRetry}
                variant={variant}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default UploadSection
