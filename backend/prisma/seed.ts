
import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME ?? 'splitmate',
  connectionLimit: 5,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const demoPassword = process.env.SEED_DEMO_PASSWORD;

  if (!demoPassword || demoPassword.length < 12) {
    throw new Error(
      'Set SEED_DEMO_PASSWORD to a password of at least 12 characters before seeding.',
    );
  }

  const demoUsers = [
    { name: 'Aarav Sharma', email: 'aarav.demo@splitmate.local' },
    { name: 'Priya Patel', email: 'priya.demo@splitmate.local' },
  ];

  const passwordHash = await argon2.hash(demoPassword, {
    type: argon2.argon2id,
  });

  const users = [];

  for (const demoUser of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: demoUser.email },
      update: {},
      create: {
        ...demoUser,
        passwordHash,
      },
    });

    users.push(user);
  }

  const groupName = 'Demo Shared Expenses';

  const group = await prisma.group.upsert({
    where: { id: 'splitmate-demo-group' },
    update: {},
    create: {
      id: 'splitmate-demo-group',
      name: groupName,
      description: 'Demo group for exploring SplitMate',
      ownerId: users[0].id,
      members: {
        create: [
          { userId: users[0].id, role: 'OWNER' },
          { userId: users[1].id, role: 'MEMBER' },
        ],
      },
    },
  });

  // Ensure both demo accounts belong to the demo group,
  // including when the group already existed.
  for (const [index, user] of users.entries()) {
    await prisma.groupMember.upsert({
      where: {
        groupId_userId: {
          groupId: group.id,
          userId: user.id,
        },
      },
      update: {},
      create: {
        groupId: group.id,
        userId: user.id,
        role: index === 0 ? 'OWNER' : 'MEMBER',
      },
    });
  }

  console.log('Seed completed.');
  console.log(`Demo users: ${demoUsers.map((u) => u.email).join(', ')}`);
  console.log(`Demo group: ${group.name}`);
  console.log('Existing user passwords were not changed.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
