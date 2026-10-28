
import { Test, TestingModule } from '@nestjs/testing';
import { SettlementsService } from './settlements.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

describe('SettlementsService', () => {
  let service: SettlementsService;

  const prismaMock = {};
  const activityServiceMock = {
    logActivity: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ActivityService, useValue: activityServiceMock },
        {
          provide: RealtimeGateway,
          useValue: {
              emitToGroup: jest.fn(),
              emitToUser: jest.fn(),
                 },
        },
      ],
    }).compile();

    service = module.get<SettlementsService>(SettlementsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
