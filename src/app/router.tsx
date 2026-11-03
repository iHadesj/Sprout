// Rotas do app. Tudo fora de /entrar e /criar-conta exige login (RequireAuth).
import { createBrowserRouter, type RouteObject } from 'react-router'
import { AccountScreen } from '../features/account/AccountScreen'
import { AuthLayout } from '../features/auth/AuthLayout'
import { LoginScreen } from '../features/auth/LoginScreen'
import { RequireAuth } from '../features/auth/RequireAuth'
import { SignupScreen } from '../features/auth/SignupScreen'
import { FocusScreen } from '../features/focus/FocusScreen'
import { FriendGarden } from '../features/friends/FriendGarden'
import { FriendsScreen } from '../features/friends/FriendsScreen'
import { InviteScreen } from '../features/friends/InviteScreen'
import { GardenLayout } from '../features/gardens/GardenLayout'
import { GardenOverview } from '../features/gardens/GardenOverview'
import { GardensScreen } from '../features/gardens/GardensScreen'
import { StatsScreen } from '../features/stats/StatsScreen'
import { Layout } from './Layout'
import { NotFound } from './NotFound'

// ferramentas só de desenvolvimento: nem entram no build de produção
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [{ path: 'dev/viveiro', lazy: async () => ({ Component: (await import('../features/dev/Nursery')).default }) }]
  : []

export const router = createBrowserRouter([
  {
    // a cena da muda fica no AuthLayout: não reinicia ao trocar entre login e cadastro
    element: <AuthLayout />,
    children: [
      { path: '/entrar', element: <LoginScreen /> },
      { path: '/criar-conta', element: <SignupScreen /> },
    ],
  },
  {
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <GardensScreen /> },
      {
        // a cena do jardim fica no GardenLayout; visão geral e foco são painéis dela
        path: 'jardim/:gardenId',
        element: <GardenLayout />,
        children: [
          { index: true, element: <GardenOverview /> },
          { path: 'foco', element: <FocusScreen /> },
        ],
      },
      { path: 'estatisticas', element: <StatsScreen /> },
      { path: 'amigos', element: <FriendsScreen /> },
      { path: 'amigos/:userId', element: <FriendGarden /> },
      // link de convite: sem login, o RequireAuth manda entrar e depois volta pra cá
      { path: 'amigo/:code', element: <InviteScreen /> },
      { path: 'conta', element: <AccountScreen /> },
      ...devRoutes,
      { path: '*', element: <NotFound /> },
    ],
  },
])
