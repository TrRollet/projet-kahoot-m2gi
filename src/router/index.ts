import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import TabsPage from '../views/TabsPage.vue'
import HomePage from '../views/HomePage.vue'
import GamesPage from '../views/GamesPage.vue'
import JoinGamePage from '../views/JoinGamePage.vue'
import QuizDetailPage from '../views/QuizDetailPage.vue';
import LoginPage from '../views/LoginPage.vue';
import RegisterPage from '../views/RegisterPage.vue';
import { useAuthStore } from '@/stores/auth.store';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'Login',
    component: LoginPage
  },
  {
    path: '/register',
    name: 'Register',
    component: RegisterPage
  },
  {
    path: '/tabs',
    component: TabsPage,
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/tabs/quizzes' },
      { path: 'quizzes', name: 'Home', component: HomePage },
      { path: 'games', name: 'Games', component: GamesPage },
      { path: 'join', name: 'Join', component: JoinGamePage },
    ]
  },
  {
    path: '/quiz/:id',
    name: 'QuizDetail',
    component: QuizDetailPage,
    meta: { requiresAuth: true }
  },
  // Compat : ancien /home
  {
    path: '/home',
    redirect: '/tabs/quizzes'
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// Guard de navigation pour protéger les routes
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  
  // Attendre que l'état d'authentification soit initialisé
  await authStore.waitForAuthInit()
  
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  
  if (requiresAuth && !authStore.isConnected) {
    // Rediriger vers login si la route nécessite l'authentification
    next({ name: 'Login', query: { redirect: to.fullPath } })
  } else if ((to.name === 'Login' || to.name === 'Register') && authStore.isConnected) {
    // Rediriger vers home si déjà connecté et tentative d'accès à login/register
    next({ path: '/tabs/quizzes' })
  } else {
    next()
  }
})


export default router
