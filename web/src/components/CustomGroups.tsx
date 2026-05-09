import React, { useState } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CustomGroup } from '../types'

interface Props {
  groups: CustomGroup[]
  onChange: (groups: CustomGroup[]) => void
}

const selectCls = "px-2 py-1 bg-[#0d1117] border border-[#30363d] rounded text-xs text-[#c9d1d9] focus:outline-none focus:border-[#388bfd]"

function SortableCard({ group, onRemove, onRename, onActionChange }: {
  group: CustomGroup
  onRemove: () => void
  onRename: (name: string) => void
  onActionChange: (action: 'PROXY' | 'DIRECT' | 'REJECT') => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: group.name })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className="border border-[#30363d] rounded-lg bg-[#161b22] p-3">
      <div className="flex items-center gap-2 mb-2">
        <span {...attributes} {...listeners} className="cursor-grab text-[#8b949e] select-none text-lg leading-none">⠿</span>
        <input
          className="flex-1 px-2 py-1 bg-[#0d1117] border border-[#30363d] rounded text-xs text-[#c9d1d9] focus:outline-none focus:border-[#388bfd]"
          value={group.name}
          onChange={e => onRename(e.target.value)}
        />
        <select className={`${selectCls} w-24`} value={group.action} onChange={e => onActionChange(e.target.value as any)}>
          <option value="PROXY">PROXY</option>
          <option value="DIRECT">DIRECT</option>
          <option value="REJECT">REJECT</option>
        </select>
        <button
          onClick={onRemove}
          className="px-2 py-1 text-xs text-[#8b949e] hover:text-[#ff7b72] transition-colors"
        >✕</button>
      </div>
      <div className="space-y-1">
        {group.members.length === 0 && (
          <p className="text-xs text-[#8b949e] text-center py-2">从左侧浏览器添加规则组</p>
        )}
        {group.members.map((m, mi) => (
          <div key={mi} className="flex items-center gap-2 text-xs bg-[#0d1117] border border-[#21262d] rounded px-2 py-1">
            <span className="flex-1 truncate">{m.label || m.id}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CustomGroups({ groups, onChange }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAction, setNewAction] = useState<'PROXY' | 'DIRECT' | 'REJECT'>('PROXY')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIdx = groups.findIndex(g => g.name === active.id)
      const newIdx = groups.findIndex(g => g.name === over.id)
      onChange(arrayMove(groups, oldIdx, newIdx))
    }
  }

  function addGroup() {
    const name = newName.trim()
    if (!name) return
    onChange([...groups, { name, action: newAction, members: [] }])
    setNewName('')
    setNewAction('PROXY')
    setShowModal(false)
  }

  function removeGroup(i: number) {
    onChange(groups.filter((_, idx) => idx !== i))
  }

  function updateGroup(i: number, patch: Partial<CustomGroup>) {
    const next = [...groups]
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }

  return (
    <div className="border border-[#30363d] rounded-lg bg-[#0d1117] p-3 min-h-[400px] flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-[#58a6ff]">自定义代理组</div>
        <button
          onClick={() => setShowModal(true)}
          className="px-2 py-1 text-xs bg-[#21262d] border border-[#30363d] rounded text-[#c9d1d9] hover:bg-[#30363d] transition-colors"
        >+ 新建组</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={groups.map(g => g.name)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {groups.map((g, i) => (
                <SortableCard
                  key={g.name}
                  group={g}
                  onRemove={() => removeGroup(i)}
                  onRename={name => updateGroup(i, { name })}
                  onActionChange={action => updateGroup(i, { action })}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        {groups.length === 0 && (
          <p className="text-xs text-[#8b949e] text-center py-8">点击"新建组"创建自定义代理组</p>
        )}
      </div>

      {/* New group modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6 w-80" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-4">新建代理组</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[#8b949e] mb-1">组名</label>
                <input
                  className="w-full px-2 py-1.5 bg-[#0d1117] border border-[#30363d] rounded text-sm text-[#c9d1d9] focus:outline-none focus:border-[#388bfd]"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addGroup()}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-[#8b949e] mb-1">默认动作</label>
                <select
                  className="w-full px-2 py-1.5 bg-[#0d1117] border border-[#30363d] rounded text-sm text-[#c9d1d9] focus:outline-none focus:border-[#388bfd]"
                  value={newAction}
                  onChange={e => setNewAction(e.target.value as any)}
                >
                  <option value="PROXY">PROXY</option>
                  <option value="DIRECT">DIRECT</option>
                  <option value="REJECT">REJECT</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-3 py-1.5 text-xs bg-[#21262d] border border-[#30363d] rounded text-[#c9d1d9] hover:bg-[#30363d]"
              >取消</button>
              <button
                onClick={addGroup}
                className="px-3 py-1.5 text-xs bg-[#1f6feb] border border-[#1f6feb] rounded text-white hover:bg-[#388bfd]"
              >创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
