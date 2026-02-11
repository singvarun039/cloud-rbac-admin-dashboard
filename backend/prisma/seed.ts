import { prisma } from "../src/db/prisma";
import { hashPassword } from "../src/utils/password";

const PERMISSION_KEYS = [
  "users.read",
  "users.write",
  "users.edit",
  "roles.read",
  "roles.write",
  "roles.edit",
  "permissions.read",
  "projects.read",
  "projects.write",
  "projects.edit",
  "audit.read",
] as const;

const READ_ONLY_PERMISSION_KEYS = new Set<string>([
  "users.read",
  "projects.read",
  "audit.read",
]);

async function main() {
  const email = "admin@naxverse.local";
  const password = "Admin@12345";

  const userEmail = "user@naxverse.local";
  const userPassword = "User@12345";

  const passwordHash = await hashPassword(password);
  const userPasswordHash = await hashPassword(userPassword);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      isActive: true,
      firstName: "Admin",
    },
    create: {
      email,
      passwordHash,
      isActive: true,
      firstName: "Admin",
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
    },
  });

  const readOnlyUser = await prisma.user.upsert({
    where: { email: userEmail },
    update: {
      passwordHash: userPasswordHash,
      isActive: true,
      firstName: "User",
    },
    create: {
      email: userEmail,
      passwordHash: userPasswordHash,
      isActive: true,
      firstName: "User",
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
    },
  });

  const [adminRole, userRole] = await Promise.all([
    prisma.role.upsert({
      where: { name: "ADMIN" },
      update: { description: "Full system access" },
      create: { name: "ADMIN", description: "Full system access" },
      select: { id: true, name: true },
    }),
    prisma.role.upsert({
      where: { name: "USER" },
      update: { description: "Limited read-only access" },
      create: { name: "USER", description: "Limited read-only access" },
      select: { id: true, name: true },
    }),
  ]);

  const permissions = await Promise.all(
    PERMISSION_KEYS.map((key) =>
      prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key, description: key },
        select: { id: true, key: true },
      }),
    ),
  );

  await prisma.rolePermission.createMany({
    data: permissions.map((p) => ({
      roleId: adminRole.id,
      permissionId: p.id,
    })),
    skipDuplicates: true,
  });

  await prisma.rolePermission.createMany({
    data: permissions
      .filter((p) => READ_ONLY_PERMISSION_KEYS.has(p.key))
      .map((p) => ({ roleId: userRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  await prisma.userRole.createMany({
    data: [{ userId: user.id, roleId: adminRole.id }],
    skipDuplicates: true,
  });

  await prisma.userRole.createMany({
    data: [{ userId: readOnlyUser.id, roleId: userRole.id }],
    skipDuplicates: true,
  });

  console.log("✅ Seeded admin user:", user);
  console.log("✅ Seeded read-only user:", readOnlyUser);
  console.log("✅ Seeded roles:", [adminRole.name, userRole.name]);
  console.log(
    "✅ Seeded permissions:",
    permissions.map((p) => p.key),
  );
  console.log("✅ Assigned ADMIN role to:", user.email);
  console.log("✅ Assigned USER role to:", readOnlyUser.email);
  console.log("🔑 Login with:", { email, password });
  console.log("🔑 Login (read-only) with:", {
    email: userEmail,
    password: userPassword,
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
