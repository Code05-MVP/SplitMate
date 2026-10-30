
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
    update: {
  passwordHash,
  isActive: true,
},
    create: {
      ...demoUser,
      passwordHash,
    },
  });

  users.push(user);
  console.log(`Login verification for ${demoUser.email}:`, {
  isActive: user.isActive,
  passwordMatches: await argon2.verify(
    user.passwordHash,
    process.env.SEED_DEMO_PASSWORD!,
  ),
});
}

  const [aarav, priya] = users;

  const group = await prisma.group.upsert({
    where: { id: 'splitmate-demo-group' },
    update: {},
    create: {
      id: 'splitmate-demo-group',
      name: 'Demo Shared Expenses',
      description: 'Demo group for exploring SplitMate',
      ownerId: aarav.id,
      members: {
        create: [
          { userId: aarav.id, role: 'OWNER' },
          { userId: priya.id, role: 'MEMBER' },
        ],
      },
    },
  });

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

  // Demo expense 1: ₹1,200 split equally.
  await prisma.expense.upsert({
    where: { id: 'splitmate-demo-expense-equal' },
    update: {
      description: 'Goa hotel booking',
      amountPaise: 120000,
      expenseDate: new Date('2026-10-28T12:00:00.000Z'),
      splitType: 'EQUAL',
      payerId: aarav.id,
      creatorId: aarav.id,
      splits: {
        deleteMany: {},
        create: [
          {
            sharePaise: 60000,
            user: { connect: { id: aarav.id } },
          },
          {
            sharePaise: 60000,
            user: { connect: { id: priya.id } },
          },
        ],
      },
    },
    create: {
      id: 'splitmate-demo-expense-equal',
      description: 'Goa hotel booking',
      amountPaise: 120000,
      expenseDate: new Date('2026-10-28T12:00:00.000Z'),
      splitType: 'EQUAL',
      groupId: group.id,
      creatorId: aarav.id,
      payerId: aarav.id,
      splits: {
        create: [
          {
            sharePaise: 60000,
            user: { connect: { id: aarav.id } },
          },
          {
            sharePaise: 60000,
            user: { connect: { id: priya.id } },
          },
        ],
      },
    },
  });

  // Demo expense 2: ₹900 split using custom shares.
  await prisma.expense.upsert({
    where: { id: 'splitmate-demo-expense-custom' },
    update: {
      description: 'Dinner and food',
      amountPaise: 90000,
      expenseDate: new Date('2026-10-29T12:00:00.000Z'),
      splitType: 'CUSTOM',
      payerId: priya.id,
      creatorId: priya.id,
      splits: {
        deleteMany: {},
        create: [
          {
            sharePaise: 30000,
            user: { connect: { id: aarav.id } },
          },
          {
            sharePaise: 60000,
            user: { connect: { id: priya.id } },
          },
        ],
      },
    },
    create: {
      id: 'splitmate-demo-expense-custom',
      description: 'Dinner and food',
      amountPaise: 90000,
      expenseDate: new Date('2026-10-29T12:00:00.000Z'),
      splitType: 'CUSTOM',
      groupId: group.id,
      creatorId: priya.id,
      payerId: priya.id,
      splits: {
        create: [
          {
            sharePaise: 30000,
            user: { connect: { id: aarav.id } },
          },
          {
            sharePaise: 60000,
            user: { connect: { id: priya.id } },
          },
        ],
      },
    },
  });

  console.log('Seed completed successfully.');
  console.log('Demo users:');
  console.log(`Aarav: ${aarav.email}`);
  console.log(`Priya: ${priya.email}`);
  console.log(`Demo group: ${group.name}`);
  console.log('Demo expenses:');
  console.log('1. Goa hotel booking - ₹1,200 (Equal split)');
  console.log('2. Dinner and food - ₹900 (Custom split)');
  console.log('Demo user passwords have been reset from SEED_DEMO_PASSWORD.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
