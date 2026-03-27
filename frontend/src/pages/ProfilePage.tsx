import { useAuthStore } from '@/stores/authStore';

export default function ProfilePage() {
  const { user } = useAuthStore();
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Perfil</h1>
      {user && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-3">
          <div><span className="text-sm text-gray-500">Nombre:</span><p className="font-medium text-gray-900 dark:text-white">{user.name}</p></div>
          <div><span className="text-sm text-gray-500">Email:</span><p className="font-medium text-gray-900 dark:text-white">{user.email}</p></div>
          <div><span className="text-sm text-gray-500">Rol:</span><p className="font-medium text-gray-900 dark:text-white">{user.role}</p></div>
          <div><span className="text-sm text-gray-500">Tenant ID:</span><p className="font-medium text-gray-900 dark:text-white text-xs">{user.tenantId}</p></div>
        </div>
      )}
    </div>
  );
}
