import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Get,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: RegisterDto) {
    return this.authService.register(
      body.name,
      body.email,
      body.password,
    );
  }

 
@Post('login')
@HttpCode(HttpStatus.OK)
async login(
  @Body() body: LoginDto,
  @Res({ passthrough: true }) response: Response,
) {
  const result = await this.authService.login(
    body.email,
    body.password,
  );

  response.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: false, // Local development only; use true in production with HTTPS.
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return {
    accessToken: result.accessToken,
    user: result.user,
  };
}

@Post('refresh')
@HttpCode(HttpStatus.OK)
async refresh(
  @Req() req: { cookies?: { refreshToken?: string } },
  @Res({ passthrough: true }) response: Response,
) {
  const result = await this.authService.refresh(
    req.cookies?.refreshToken ?? '',
  );

  response.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: false, // Local development only
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return {
    accessToken: result.accessToken,
    user: result.user,
  };
}

@Post('logout')
@HttpCode(HttpStatus.OK)
async logout(
  @Req() req: { cookies?: { refreshToken?: string } },
  @Res({ passthrough: true }) response: Response,
) {
  await this.authService.logout(req.cookies?.refreshToken ?? '');

  response.clearCookie('refreshToken', {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/api/v1/auth',
  });

  return { message: 'Logged out successfully' };
}



  
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req: { user: { userId: string; email: string } }) {
    return {
      userId: req.user.userId,
      email: req.user.email,
    };
  }

}
