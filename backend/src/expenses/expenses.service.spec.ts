
import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ExpensesService } from './expenses.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

describe('ExpensesService authorization', () => {
  let service: ExpensesService;

  const expense = {
    id: 'expense-1',
    groupId: 'group-1',
    creatorId: 'creator-1',
    payerId: 'owner-1',
    description: 'Lunch',
    amountPaise: 1000,
    expenseDate: new Date('2026-10-29'),
    splitType: 'EQUAL',
    deletedAt: null,
    version: 1,
    splits: [{ userId: 'owner-1', sharePaise: 1000 }],
  };

  const updatedExpense = { ...expense, version: 2 };
  const deletedExpense = { ...expense, deletedAt: new Date() };

  const txMock = {
    expenseSplit: {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    expense: {
      update: jest.fn(),
    },
  };

  const prismaMock = {
    expense: {
      findFirst: jest.fn(),
    },
    group: {
      findUnique: jest.fn(),
    },
    groupMember: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const activityMock = {
    logActivity: jest.fn().mockResolvedValue(undefined),
  };

  const realtimeMock = {
    broadcastToGroup: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    txMock.expense.update
  .mockReset()
  .mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    if ('deletedAt' in data) {
      return deletedExpense;
    }

    return updatedExpense;
  });

    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof txMock) => unknown) =>
        callback(txMock),
    );



    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ActivityService, useValue: activityMock },
        { provide: RealtimeGateway, useValue: realtimeMock },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
  });

  function setupExpense(requesterId: string, ownerId = 'owner-1') {
    prismaMock.expense.findFirst.mockResolvedValue(expense);
    prismaMock.group.findUnique.mockResolvedValue({ ownerId });
    prismaMock.groupMember.findUnique.mockResolvedValue({
      groupId: 'group-1',
      userId: requesterId,
    });
    prismaMock.groupMember.findMany.mockResolvedValue([
      { userId: 'owner-1' },
    ]);
  }

  it('allows the expense creator to edit', async () => {
    setupExpense('creator-1');

    await expect(
      service.updateExpense(
        'group-1',
        'expense-1',
        'creator-1',
        {},
      ),
    ).resolves.toEqual(updatedExpense);
  });

  it('allows the group owner to edit another member’s expense', async () => {
    setupExpense('owner-1');

    await expect(
      service.updateExpense(
        'group-1',
        'expense-1',
        'owner-1',
        {},
      ),
    ).resolves.toEqual(updatedExpense);
  });

  it('rejects an unrelated member trying to edit an expense', async () => {
    setupExpense('other-member-1');

    await expect(
      service.updateExpense(
        'group-1',
        'expense-1',
        'other-member-1',
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('allows the expense creator to delete', async () => {
    setupExpense('creator-1');

    await expect(
      service.deleteExpense(
        'group-1',
        'expense-1',
        'creator-1',
      ),
    ).resolves.toEqual(deletedExpense);
  });

  it('allows the group owner to delete another member’s expense', async () => {
    setupExpense('owner-1');

    await expect(
      service.deleteExpense(
        'group-1',
        'expense-1',
        'owner-1',
      ),
    ).resolves.toEqual(deletedExpense);
  });

  it('rejects an unrelated member trying to delete an expense', async () => {
    setupExpense('other-member-1');

    await expect(
      service.deleteExpense(
        'group-1',
        'expense-1',
        'other-member-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
