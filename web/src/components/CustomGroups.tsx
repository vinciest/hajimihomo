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

const ACTION_BADGE: Record<string, string> = {
  PROXY: 'badge-info',
  DIRECT: 'badge-success',
  REJECT: 'badge-error',
}

function SortableCard({ group, onRemove, onRename, onActionChange }: {
  group: CustomGroup
  onRemove: () => void
  onRename: (name: string) => void
  onActionChange: (action: 'PROXY' | 'DIRECT' | 'REJECT') => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: group.name })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className="card card-compact bg-base-200 mb-2">
      <div className="card-body flex-row items-center gap-2">
        <span {...attributes} {...listeners} className="cursor-grab opacity-50 hover:opacity-100 select-none text-lg leading-none">⠿</span>
        <input
          className="input input-bordered input-xs flex-1"
          value={group.name}
          onChange={e => onRename(e.target.value)}
        />
        <select
          className="select select-bordered select-xs w-24"
          value={group.action}
          onChange={e => onActionChange(e.target.value as any)}
        >
          <option value="PROXY">PROXY</option>
          <option value="DIRECT">DIRECT</option>
          <option value="REJECT">REJECT</option>
        </select>
        <button onClick={onRemove} className="btn btn-ghost btn-xs btn-circle text-error">✕</button>
      </div>
      {group.members.length > 0 && (
        <div className="px-4 pb-3 space-y-1">
          {group.members.map((m, mi) => (
            <div key={mi} className="flex items-center gap-2 text-xs bg-base-100 rounded px-2 py-1">
              <span className="flex-1 truncate">{m.label || m.id}</span>
              <span className={`badge badge-xs ${ACTION_BADGE[group.action] ?? 'badge-ghost'}`}>{group.action}</span>
            </div>
          ))}
        </div>
      )}
      {group.members.length === 0 && (
        <p className="text-xs opacity-40 text-center pb-3">从左侧浏览器添加规则组</p>
      )}
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
    <div className="card bg-base-200 min-h-96 flex flex-col">
      <div className="card-body p-3 flex flex-col gap-2 h-full">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-widest opacity-50">自定义代理组</div>
          <button onClick={() => setShowModal(true)} className="btn btn-sm btn-ghost">+ 新建组</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={groups.map(g => g.name)} strategy={verticalListSortingStrategy}>
              {groups.map((g, i) => (
                <SortableCard
                  key={g.name}
                  group={g}
                  onRemove={() => removeGroup(i)}
                  onRename={name => updateGroup(i, { name })}
                  onActionChange={action => updateGroup(i, { action })}
                />
              ))}
            </SortableContext>
          </DndContext>
          {groups.length === 0 && (
            <p className="text-xs opacity-40 text-center py-8">点击"新建组"创建自定义代理组</p>
          )}
        </div>

        {/* New group modal */}
        {showModal && (
          <div className="modal modal-open" onClick={() => setShowModal(false)}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
              <h3 className="font-semibold text-sm mb-4">新建代理组</h3>
              <div className="space-y-3">
                <div className="form-control">
                  <label className="label"><span className="label-text">组名</span></label>
                  <input
                    className="input input-bordered w-full"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addGroup()}
                    autoFocus
                  />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">默认动作</span></label>
                  <select
                    className="select select-bordered w-full"
                    value={newAction}
                    onChange={e => setNewAction(e.target.value as any)}
                  >
                    <option value="PROXY">PROXY</option>
                    <option value="DIRECT">DIRECT</option>
                    <option value="REJECT">REJECT</option>
                  </select>
                </div>
              </div>
              <div className="modal-action">
                <button onClick={() => setShowModal(false)} className="btn btn-ghost btn-sm">取消</button>
                <button onClick={addGroup} className="btn btn-primary btn-sm">创建</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
