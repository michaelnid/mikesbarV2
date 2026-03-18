export const getUserPermissions = (user) => {
    const permissions = new Set(['PLAYER']);

    if (Array.isArray(user?.permissionGroups)) {
        user.permissionGroups.forEach((permission) => {
            if (permission) {
                permissions.add(String(permission).toUpperCase());
            }
        });
    }

    if (typeof user?.permissions === 'string') {
        user.permissions
            .split(',')
            .map((permission) => permission.trim().toUpperCase())
            .filter(Boolean)
            .forEach((permission) => permissions.add(permission));
    }

    if (typeof user?.role === 'string') {
        const role = user.role.toUpperCase();
        if (role === 'ADMIN' || role === 'DEALER') {
            permissions.add(role);
        }
    }

    return [...permissions];
};

export const hasPermission = (user, permission) =>
    getUserPermissions(user).includes(permission.toUpperCase());
