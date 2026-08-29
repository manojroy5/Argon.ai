import { CaretDown } from '@phosphor-icons/react/CaretDown'
import { CheckCircle } from '@phosphor-icons/react/CheckCircle'
import { ImageSquare } from '@phosphor-icons/react/ImageSquare'
import './App.css'
import ImageUploader from './components/ImageUploader.jsx'
import UploadSection from './components/UploadSection.jsx'
import useImageUploads from './hooks/useImageUploads.js'

const RECOMMENDED_PHOTO_COUNT = 10

function App() {
  const {
    acceptedUploads,
    activeUploads,
    rejectedUploads,
    addFiles,
    removeUpload,
    retryUpload,
    clearAccepted,
    clearRejected,
  } = useImageUploads()

  const acceptedProgress = Math.min(
    (acceptedUploads.length / RECOMMENDED_PHOTO_COUNT) * 100,
    100,
  )

  return (
    <div className="app-shell">
      <header className="top-bar">
        <a className="brand" href="#top" aria-label="Argon AI image intake">
          <span className="brand-icon"><ImageSquare weight="fill" /></span>
          <span>Argon AI</span>
        </a>
        <div className="journey-progress" aria-label="Photo upload step">
          <span>Build your photo set</span>
          <div className="journey-track"><div className="journey-fill" /></div>
        </div>
        <span className="step-label">Step 1 of 2</span>
      </header>

      <main className="workspace" id="top">
        <aside className="upload-sidebar">
          <div className="sidebar-intro">
            <p className="eyebrow">Photo intake</p>
            <h1>Add your best photos</h1>
            <p>
              Upload a mix of close-ups, selfies, and mid-range shots so we can
              clearly capture your face and appearance.
            </p>
          </div>

          <ImageUploader onFilesSelected={addFiles} />
          <p className="upload-note">Uploads are checked automatically and may take a few seconds.</p>

          <UploadSection
            title="Upload queue"
            description="Files currently being checked."
            uploads={activeUploads}
            tone="processing"
            variant="compact"
            emptyMessage="Select photos to begin."
            onRemove={removeUpload}
          />
        </aside>

        <section className="results-panel" aria-label="Upload results">
          <div className="results-summary">
            <div className="summary-copy">
              <div>
                <p className="summary-label">Uploaded images</p>
                <p className="summary-help">Aim for 10 varied, high-quality portraits.</p>
              </div>
              <strong>{acceptedUploads.length} of {RECOMMENDED_PHOTO_COUNT}</strong>
            </div>
            <div className="accepted-progress" aria-label={`${acceptedUploads.length} of 10 recommended images accepted`}>
              <div style={{ width: `${acceptedProgress}%` }} />
            </div>
          </div>

          <UploadSection
            title="Accepted photos"
            description="These photos are ready to use."
            uploads={acceptedUploads}
            tone="accepted"
            variant="gallery"
            emptyMessage="Photos that pass validation will appear here."
            onRemove={removeUpload}
            onClear={clearAccepted}
          />

          <UploadSection
            title="Some photos didn’t meet our guidelines"
            description={rejectedUploads.length > 0
              ? 'Review each reason below, then replace the photo if needed.'
              : 'Photos that need attention will appear here with a clear reason.'}
            uploads={rejectedUploads}
            tone="rejected"
            variant="gallery"
            emptyMessage="No rejected photos yet."
            onRemove={removeUpload}
            onRetry={retryUpload}
            onClear={clearRejected}
          />

          <details className="requirements-panel">
            <summary>
              <span><CheckCircle size={20} weight="fill" /> Photo requirements</span>
              <CaretDown className="summary-chevron" size={17} weight="bold" aria-hidden="true" />
            </summary>
            <ul>
              <li>Use JPG, PNG, or HEIC files between 20 KB and 15 MB.</li>
              <li>Choose images at least 600 × 600 pixels with one clearly visible face.</li>
              <li>Avoid blur, distant faces, group photos, and near-duplicate images.</li>
            </ul>
          </details>
        </section>
      </main>

      <div className="status-announcer" aria-live="polite" aria-atomic="true">
        {activeUploads.length > 0
          ? `${activeUploads.length} image${activeUploads.length === 1 ? '' : 's'} processing`
          : 'No images currently processing'}
      </div>
    </div>
  )
}

export default App
