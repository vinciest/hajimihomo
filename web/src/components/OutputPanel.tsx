import React from 'react'
import type { KernelTarget } from '../types'

interface Props {
  output: string
  error: string | null
  generating: boolean
  onGenerate: () => void
  target: KernelTarget
  mode: 'simple' | 'advanced'
  preset: string
}

export function OutputPanel({ output, error, generating, onGenerate, target, mode, preset }: Props) {
  function handleCopy() {
    if (output) navigator.clipboard.writeText(output).then(() => alert('已复制到剪贴板'))
  }

  function handleDownload() {
    if (!output) return
    const ext = target === 'singbox' ? 'json' : 'yaml'
    const name = mode === 'advanced' ? 'custom' : preset
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([output], { type: 'text/plain' }))
    a.download = `${name}-${target}.${ext}`
    a.click()
  }

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <button
          onClick={onGenerate}
          disabled={generating}
          className="btn btn-primary"
        >
          {generating ? <span className="loading loading-spinner loading-sm" /> : null}
          {generating ? '生成中…' : '生成配置'}
        </button>
        {output && (
          <>
            <button onClick={handleCopy} className="btn btn-ghost btn-sm">复制</button>
            <button onClick={handleDownload} className="btn btn-ghost btn-sm">
              下载 .{target === 'singbox' ? 'json' : 'yaml'}
            </button>
          </>
        )}
      </div>

      {error && (
        <div role="alert" className="alert alert-error mb-3 text-xs">
          <span>{error}</span>
        </div>
      )}

      {output && (
        <textarea
          readOnly
          className="textarea textarea-bordered w-full font-mono text-xs h-96"
          value={output}
        />
      )}
    </div>
  )
}
