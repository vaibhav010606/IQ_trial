import React, { useState } from 'react';
import MathText from './MathText';

const NumericKeypad = ({ value, onChange }) => {
  const handleKeyClick = (key) => {
    if (key === 'Clear') return onChange('');
    if (key === 'Backspace') return onChange(value.slice(0, -1));
    if (key === '-') {
      if (value.startsWith('-')) return onChange(value.slice(1));
      return onChange('-' + value);
    }
    if (key === '.') {
      if (value.includes('.')) return;
      return onChange(value + '.');
    }
    if (value.length > 15) return;
    onChange(value + key);
  };

  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', '-', 'Backspace', 'Clear'];

  return (
    <div className="numeric-keypad">
      {keys.map(k => (
        <button
          key={k}
          className={`keypad-btn ${k === 'Clear' ? 'keypad-clear' : ''} ${k === 'Backspace' ? 'keypad-backspace' : ''}`}
          type="button"
          onClick={() => handleKeyClick(k)}
        >
          {k === 'Backspace' ? '⌫' : k}
        </button>
      ))}
    </div>
  );
};

/* Full-screen image lightbox */
const Lightbox = ({ url, onClose }) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'zoom-out', padding: '24px',
    }}
  >
    <button
      onClick={onClose}
      aria-label="Close image preview"
      title="Close image preview"
      style={{
        position: 'absolute', top: 16, right: 20,
        background: 'rgba(255,255,255,0.15)', border: 'none',
        color: '#fff', fontSize: '28px', cursor: 'pointer',
        borderRadius: '50%', width: 40, height: 40,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >&times;</button>
    <img
      src={url}
      alt="Question enlarged"
      onClick={e => e.stopPropagation()}
      style={{
        maxWidth: '94vw', maxHeight: '92vh',
        borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
        objectFit: 'contain',
      }}
    />
  </div>
);

const QuestionPanel = ({ question, qIndex, currentResponse, onResponseChange }) => {
  const [lightboxUrl, setLightboxUrl] = useState(null);

  if (!question) return <div className="q-panel loading">Loading question...</div>;

  const handleResponseUpdate = (payload) => {
    let newStatus = 'answered';
    if (currentResponse?.status === 'marked' || currentResponse?.status === 'answered_marked') {
      newStatus = 'answered_marked';
    }
    onResponseChange(question.id, payload, newStatus);
  };

  const handleMCQSelect = (idx) => handleResponseUpdate({ index: idx });

  const handleMSQToggle = (idx) => {
    const currentSelected = currentResponse?.indices || [];
    const newSelected = currentSelected.includes(idx)
      ? currentSelected.filter(i => i !== idx)
      : [...currentSelected, idx];
    handleResponseUpdate({ indices: newSelected });
  };

  const handleNATChange = (val) => handleResponseUpdate({ value: val });

  /* Render a single option — shows image if available, else text */
  const renderOpt = (opt, idx, isSelected, onChange, inputType) => {
    const optText = typeof opt === 'object' ? opt?.text : opt;
    const optImage = typeof opt === 'object' ? opt?.image_url : null;
    return (
      <label key={idx} className={`q-option ${isSelected ? 'selected' : ''}`}>
        <input
          type={inputType}
          name={`q-${question.id}`}
          checked={isSelected}
          onChange={onChange}
        />
        <span className="opt-label" aria-hidden="true">{String.fromCharCode(65 + idx)}</span>
        {optImage
          ? <img
              src={optImage}
              alt={`Option ${String.fromCharCode(65 + idx)}`}
              onClick={() => setLightboxUrl(optImage)}
              style={{ maxHeight: 80, borderRadius: 4, cursor: 'zoom-in', marginLeft: 8 }}
            />
          : <span className="opt-text"><MathText text={String(optText ?? '')} /></span>
        }
      </label>
    );
  };

  const renderOptions = () => {
    if (question.type === 'mcq') {
      return (
        <div className="q-options mcq">
          {question.options?.map((opt, idx) =>
            renderOpt(opt, idx, currentResponse?.index === idx, () => handleMCQSelect(idx), 'radio')
          )}
        </div>
      );
    }

    if (question.type === 'msq') {
      return (
        <div className="q-options msq">
          <p className="q-instruction">Multiple options can be correct. Select all that apply.</p>
          {question.options?.map((opt, idx) =>
            renderOpt(
              opt, idx,
              currentResponse?.indices?.includes(idx) || false,
              () => handleMSQToggle(idx),
              'checkbox'
            )
          )}
        </div>
      );
    }

    if (question.type === 'nat') {
      const val = currentResponse?.value ?? '';
      return (
        <div className="q-options nat">
          <div className="nat-input-container">
            <input
              type="text"
              className="nat-display"
              value={val}
              readOnly
              placeholder="Use keypad to enter answer"
              onKeyDown={(e) => e.preventDefault()}
            />
          </div>
          <NumericKeypad value={val} onChange={handleNATChange} />
        </div>
      );
    }
  };

  return (
    <>
      <div className="q-panel">
        <div className="q-meta">
          <span className="q-number">Question {qIndex + 1}</span>
          {question.type && <span className="q-type-badge">{question.type.toUpperCase()}</span>}
        </div>

        {/* Question body — image takes priority over text */}
        <div className="q-text">
          {question.image_url ? (
            <img
              src={question.image_url}
              alt={`Question ${qIndex + 1}`}
              onClick={() => setLightboxUrl(question.image_url)}
              style={{
                maxWidth: '100%',
                borderRadius: 6,
                cursor: 'zoom-in',
                display: 'block',
                marginBottom: 12,
              }}
            />
          ) : (
            <MathText as="p" text={question.question_text || ''} />
          )}
        </div>

        {renderOptions()}
      </div>

      {lightboxUrl && <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </>
  );
};

export default QuestionPanel;
