'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import { BackToHome } from '@/components/ui/back-to-home';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/lib/hooks/useToast';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
type RoleType =
  | 'EMPLOYEE'
  | 'ENGINEER_IT'
  | 'ENGINEER_TRAVEL'
  | 'ADMIN_IT'
  | 'ADMIN_TRAVEL'
  | 'ADMIN_HR'
  | 'SUPER_ADMIN';

interface Role {
  id: string;
  type: RoleType;
  name: string;
  description?: string;
}

interface User {
  id: string;
  email: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  profile?: {
    empName?: string;
    employeeId?: number;
    gradeCode?: string;
    location?: string;
    projectCode?: string;
  };
  roles: Array<{
    id: string;
    type: RoleType;
    name: string;
    grantedAt: string;
    grantedBy?: string;
  }>;
}

const STATUS_COLORS: Record<UserStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
  SUSPENDED: 'bg-red-100 text-red-800',
};

const ROLE_COLORS: Record<RoleType, string> = {
  EMPLOYEE: 'bg-blue-100 text-blue-800',
  ENGINEER_IT: 'bg-purple-100 text-purple-800',
  ENGINEER_TRAVEL: 'bg-cyan-100 text-cyan-800',
  ADMIN_IT: 'bg-orange-100 text-orange-800',
  ADMIN_TRAVEL: 'bg-teal-100 text-teal-800',
  ADMIN_HR: 'bg-pink-100 text-pink-800',
  SUPER_ADMIN: 'bg-red-100 text-red-800',
};

export default function AdminUsersPage() {
  const router = useRouter();
  const { showToast, ToastContainer } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<RoleType[]>([]);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, [statusFilter, searchQuery]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 403) {
          showToast('Access denied. Super Admin or HR Admin role required.', 'error');
          router.push('/');
          return;
        }
        throw new Error('Failed to fetch users');
      }

      const data = await res.json();
      setUsers(data.users || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      showToast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await fetch('/api/admin/roles');
      if (res.ok) {
        const data = await res.json();
        setRoles(data.roles || []);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const updateUserStatus = async (userId: string, status: UserStatus) => {
    try {
      setUpdating(userId);
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        throw new Error('Failed to update user status');
      }

      showToast('User status updated', 'success');
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      showToast('Failed to update user status', 'error');
    } finally {
      setUpdating(null);
    }
  };

  const updateUserRoles = async (userId: string) => {
    try {
      setUpdating(userId);
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: selectedRoles }),
      });

      if (!res.ok) {
        throw new Error('Failed to update user roles');
      }

      showToast('User roles updated', 'success');
      setSelectedUser(null);
      setSelectedRoles([]);
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating roles:', error);
      showToast('Failed to update user roles', 'error');
    } finally {
      setUpdating(null);
    }
  };

  const handleRoleToggle = (roleType: RoleType) => {
    setSelectedRoles((prev) =>
      prev.includes(roleType)
        ? prev.filter((r) => r !== roleType)
        : [...prev, roleType]
    );
  };

  const openRoleEditor = (user: User) => {
    setSelectedUser(user);
    setSelectedRoles(user.roles.map((r) => r.type));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage users, assign roles, and control access
          </p>
        </div>
        <BackToHome />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1 block">Search</label>
              <Input
                type="text"
                placeholder="Search by email or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded-md w-full"
              >
                <option value="">All</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No users found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {users.map((user) => (
            <Card key={user.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={STATUS_COLORS[user.status]}>
                        {user.status}
                      </Badge>
                      <span className="font-semibold">{user.email}</span>
                    </div>
                    {user.profile?.empName && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {user.profile.empName}
                        {user.profile.employeeId && ` (ID: ${user.profile.employeeId})`}
                        {user.profile.location && ` • ${user.profile.location}`}
                        {user.profile.projectCode && ` • ${user.profile.projectCode}`}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mb-2">
                      {user.roles.map((role) => (
                        <Badge key={role.id} className={ROLE_COLORS[role.type]}>
                          {role.name}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Created: {formatDate(user.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 min-w-[200px]">
                    <select
                      value={user.status}
                      onChange={(e) =>
                        updateUserStatus(user.id, e.target.value as UserStatus)
                      }
                      className="px-3 py-1.5 text-sm border rounded-md"
                      disabled={updating === user.id}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="SUSPENDED">Suspended</option>
                    </select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openRoleEditor(user)}
                      disabled={updating === user.id}
                    >
                      Manage Roles
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Role Editor Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Manage Roles: {selectedUser.email}</CardTitle>
              <CardDescription>
                Select roles to assign to this user
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {roles.map((role) => (
                  <label
                    key={role.id}
                    className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role.type)}
                      onChange={() => handleRoleToggle(role.type)}
                      className="rounded"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{role.name}</div>
                      {role.description && (
                        <div className="text-sm text-muted-foreground">
                          {role.description}
                        </div>
                      )}
                    </div>
                    {selectedRoles.includes(role.type) && (
                      <Badge className={ROLE_COLORS[role.type]}>
                        Selected
                      </Badge>
                    )}
                  </label>
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedUser(null);
                    setSelectedRoles([]);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => updateUserRoles(selectedUser.id)}
                  disabled={updating === selectedUser.id}
                >
                  {updating === selectedUser.id ? (
                    <Spinner className="w-4 h-4" />
                  ) : (
                    'Save Roles'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <ToastContainer />
    </div>
  );
}

