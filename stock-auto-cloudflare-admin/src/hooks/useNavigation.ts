import { createContext, useContext } from 'react'

interface NavigationContextType {
  navigate: (tab: string) => void
}

export const NavigationContext = createContext<NavigationContextType>({ navigate: () => {} })
export const useNavigation = () => useContext(NavigationContext)
