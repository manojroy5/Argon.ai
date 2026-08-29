import { UploadSimple } from '@phosphor-icons/react/UploadSimple'
import { useRef, useState } from 'react'

const ACCEPTED_FILES = '.jpg,.jpeg,.png,.heic,image/jpeg,image/png,image/heic,image/heic-sequence'

function ImageUploader({ onFilesSelected }) {
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  const selectFiles = (fileList) => {
    const files = Array.from(fileList ?? [])
    if (files.length > 0) onFilesSelected(files)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragging(false)
    selectFiles(event.dataTransfer.files)
  }

  return (
    <label
      className={`drop-zone${isDragging ? ' is-dragging' : ''}`}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          inputRef.current?.click()
        }
      }}
      onDragEnter={(event) => { event.preventDefault(); setIsDragging(true) }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false)
      }}
      onDrop={handleDrop}
      tabIndex={0}
    >
      <input
        ref={inputRef}
        className="file-input"
        type="file"
        accept={ACCEPTED_FILES}
        multiple
        onChange={(event) => {
          selectFiles(event.target.files)
          event.target.value = ''
        }}
      />
      <span className="upload-icon" aria-hidden="true"><UploadSimple size={25} weight="bold" /></span>
      <strong>{isDragging ? 'Drop photos here' : 'Click to upload or drag and drop'}</strong>
      <span className="upload-formats">PNG, JPG, or HEIC · up to 15 MB</span>
      <span className="browse-button">Choose photos</span>
    </label>
  )
}

export default ImageUploader
