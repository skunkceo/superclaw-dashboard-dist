'use client'
import { createContext, useContext, useState, ReactNode } from 'react'

export interface PageContext {
  page: string
  data?: Record<string, unknown>
}

interface ChatContextType {
  pageContext: PageContext | null
  setPageContext: (ctx: PageContext) => void
}

const ChatPageContext = createContext<ChatContextType>({
  pageContext: null,
  setPageContext: () => {}
})

export function ChatPageContextProvider({ children }: { children: ReactNode }) {
  const [pageContext, setPageContext] = useState<PageContext | null>(null)
  return (
    <ChatPageContext.Provider value={{ pageContext, setPageContext }}>
      {children}
    </ChatPageContext.Provider>
  )
}

export function useChatContext() {
  return useContext(ChatPageContext)
}
