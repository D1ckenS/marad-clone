import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, id, style, ...rest }: InputProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label htmlFor={id} style={{ fontSize: 12.5, fontWeight: 500, color: '#41546A' }}>
          {label}
        </label>
      )}
      <input
        id={id}
        {...rest}
        style={{
          borderRadius: 6,
          border: `1px solid ${error ? '#AB382E' : '#E5E3DA'}`,
          padding: '6px 10px',
          fontSize: 13,
          color: '#0A1F33',
          fontFamily: 'inherit',
          background: '#fff',
          outline: 'none',
          transition: 'border-color .12s, box-shadow .12s',
          width: '100%',
          ...style,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = '#0A1F33';
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(10,31,51,.08)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? '#AB382E' : '#E5E3DA';
          e.currentTarget.style.boxShadow = 'none';
        }}
      />
      {error && <p style={{ fontSize: 11.5, color: '#AB382E', margin: 0 }}>{error}</p>}
    </div>
  );
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function TextArea({ label, error, id, style, ...rest }: TextAreaProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label htmlFor={id} style={{ fontSize: 12.5, fontWeight: 500, color: '#41546A' }}>
          {label}
        </label>
      )}
      <textarea
        id={id}
        {...rest}
        style={{
          borderRadius: 6,
          border: `1px solid ${error ? '#AB382E' : '#E5E3DA'}`,
          padding: '6px 10px',
          fontSize: 13,
          color: '#0A1F33',
          fontFamily: 'inherit',
          resize: 'vertical',
          background: '#fff',
          outline: 'none',
          transition: 'border-color .12s, box-shadow .12s',
          width: '100%',
          ...style,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = '#0A1F33';
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(10,31,51,.08)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? '#AB382E' : '#E5E3DA';
          e.currentTarget.style.boxShadow = 'none';
        }}
      />
      {error && <p style={{ fontSize: 11.5, color: '#AB382E', margin: 0 }}>{error}</p>}
    </div>
  );
}
