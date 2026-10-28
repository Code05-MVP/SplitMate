
import { Test, TestingModule } from '@nestjs/testing';
import { SettlementsController } from './settlements.controller';
import { SettlementsService } from './settlements.service';

describe('SettlementsController', () => {
  let controller: SettlementsController;

  const settlementsServiceMock = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettlementsController],
      providers: [
        { provide: SettlementsService, useValue: settlementsServiceMock },
      ],
    }).compile();

    controller = module.get<SettlementsController>(SettlementsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
