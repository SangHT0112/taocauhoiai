"use client"

import { createContext, useContext, ReactNode } from "react"

interface UserContextType {
  userId: number | null
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children, userId }: { children: ReactNode; userId: number | null }) {
  return (
    <UserContext.Provider value={{ userId }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}