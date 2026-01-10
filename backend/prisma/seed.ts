import { prisma } from "../src/db/prisma";
import { hashPassword } from "../src/utils/password";

const PERMISSION_KEYS = [
  "users.read",
  "users.write",
  "roles.read",
  "roles.write",
  "permissions.read",
  "projects.read",
  "projects.write",
  "audit.read",
] as const;

const READ_ONLY_PERMISSION_KEYS = new Set<string>([
  "users.read",
  "roles.read",
  "permissions.read",
  "projects.read",
  "audit.read",
]);

async function main() {
  const email = "admin@naxverse.local";
  const password = "Admin@12345";

  const passwordHash = await hashPassword(password);

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
      })
    )
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

  console.log("✅ Seeded admin user:", user);
  console.log("✅ Seeded roles:", [adminRole.name, userRole.name]);
  console.log(
    "✅ Seeded permissions:",
    permissions.map((p) => p.key)
  );
  console.log("✅ Assigned ADMIN role to:", user.email);
  console.log("🔑 Login with:", { email, password });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
