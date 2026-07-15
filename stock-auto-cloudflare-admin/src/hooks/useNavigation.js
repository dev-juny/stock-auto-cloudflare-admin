import { createContext, useContext } from 'react';
export const NavigationContext = createContext({ navigate: () => { } });
export const useNavigation = () => useContext(NavigationContext);
