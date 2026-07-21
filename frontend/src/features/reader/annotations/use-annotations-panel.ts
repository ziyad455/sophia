import { useCallback, useState } from 'react'
import type { AnnotationTab } from './annotation.types'

export type OpenAnnotationsOptions = {
  tab?: AnnotationTab
  noteId?: string | null
}

export function useAnnotationsPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<AnnotationTab>('all')
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)

  const openPanel = useCallback((options: OpenAnnotationsOptions = {}) => {
    setActiveTab(options.tab ?? 'all')
    setSelectedNoteId(options.noteId ?? null)
    setIsOpen(true)
  }, [])

  const closePanel = useCallback(() => {
    setIsOpen(false)
    setSelectedNoteId(null)
  }, [])

  const selectTab = useCallback((tab: AnnotationTab) => {
    setActiveTab(tab)
    setSelectedNoteId(null)
  }, [])

  const selectNote = useCallback((noteId: string | null) => {
    setSelectedNoteId(noteId)
  }, [])

  return {
    isOpen,
    activeTab,
    selectedNoteId,
    openPanel,
    closePanel,
    selectTab,
    selectNote,
  }
}
