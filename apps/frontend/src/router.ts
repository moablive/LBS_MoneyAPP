import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from './stores/auth';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login',       name: 'login',        component: () => import('./views/LoginView.vue'), meta: { public: true } },
    { path: '/',            name: 'dashboard',    component: () => import('./views/DashboardView.vue') },
    { path: '/transacoes',  name: 'transactions', component: () => import('./views/TransactionsView.vue') },
    { path: '/recorrentes', name: 'recurrents',   component: () => import('./views/RecurrentsView.vue') },
    { path: '/emprestimos/:type', name: 'loans',  component: () => import('./views/LoansView.vue'), props: true },
    { path: '/contas',      name: 'accounts',     component: () => import('./views/AccountsView.vue') },
    { path: '/categorias',  name: 'categories',   component: () => import('./views/CategoriesView.vue') },
    { path: '/investimentos', name: 'investments', component: () => import('./views/InvestmentsView.vue') },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.public) return true;
  if (!auth.isAuthenticated) {
    return { name: 'login', query: { next: to.fullPath } };
  }
  return true;
});
