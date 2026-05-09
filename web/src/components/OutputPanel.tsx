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

  const btnBase = "px-3 py-1.5 text-sm rounded border cursor-pointer transition-colors disabled:opacity-50"

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={onGenerate}
          disabled={generating}
          className={`${btnBase} bg-[#238636] border-[#238636] text-white hover:bg-[#2ea043] disabled:cursor-not-allowed`}
        >
          {generating ? '生成中…' : '生成配置'}
        </button>
        {output && (
          <>
            <button onClick={handleCopy} className={`${btnBase} bg-[#21262d] border-[#30363d] text-[#c9d1d9] hover:bg-[#30363d]`}>
              复制
            </button>
            <button onClick={handleDownload} className={`${btnBase} bg-[#21262d] border-[#30363d] text-[#c9d1d9] hover:bg-[#30363d]`}>
              下载 .{target === 'singbox' ? 'json' : 'yaml'}
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-[#3d0000] border border-red-800 rounded px-3 py-2 mb-3">
          {error}
        </div>
      )}

      {output && (
        <pre className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-[500px] overflow-y-auto">
          {output}
        </pre>
      )}
    </div>
  )
}
