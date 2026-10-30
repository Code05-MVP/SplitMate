
import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async register(name: string, email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException(
        'An account with this email already exists',
      );
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    const user = await this.prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    return user;
  }

           
async validateCredentials(email: string, password: string) {
  const user = await this.prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
    
     let passwordMatches = false;

    if (user) {
    try {
      passwordMatches = await argon2.verify(
        user.passwordHash,
        password,
      );
    } catch (error) {
      console.error(
        'Password verification failed:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw error;
    }
  }

  if (!user || !user.isActive || !passwordMatches) {
    throw new UnauthorizedException('Invalid email or password');
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}


  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }

    const tokenHash = this.hashRefreshToken(refreshToken);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt <= new Date() ||
      !storedToken.user.isActive
    ) {
      throw new UnauthorizedException(
        'Invalid or expired refresh token',
      );
    }

    const newRefreshToken = randomBytes(64).toString('hex');
    const newTokenHash = this.hashRefreshToken(newRefreshToken);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const revokeResult = await tx.refreshToken.updateMany({
        where: {
          id: storedToken.id,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now },
      });

      if (revokeResult.count !== 1) {
        throw new UnauthorizedException(
          'Refresh token has already been used',
        );
      }

      await tx.refreshToken.create({
        data: {
          tokenHash: newTokenHash,
          expiresAt: new Date(
            now.getTime() + 7 * 24 * 60 * 60 * 1000,
          ),
          userId: storedToken.userId,
        },
      });
    });

    const accessToken = await this.jwtService.signAsync(
      {
        sub: storedToken.user.id,
        email: storedToken.user.email,
      },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '15m',
      },
    );

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: storedToken.user.id,
        name: storedToken.user.name,
        email: storedToken.user.email,
      },
    };
  }

  async logout(refreshToken: string) {
    if (!refreshToken) {
      return { message: 'Logged out successfully' };
    }

    const tokenHash = this.hashRefreshToken(refreshToken);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (storedToken && !storedToken.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: {
          id: storedToken.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    return { message: 'Logged out successfully' };
  }

  async login(email: string, password: string) {
    const user = await this.validateCredentials(email, password);

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '15m',
      },
    );

    const refreshToken = randomBytes(64).toString('hex');
    const tokenHash = this.hashRefreshToken(refreshToken);
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    );

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        expiresAt,
        userId: user.id,
      },
    });

    return {
      accessToken,
      refreshToken,
      user,
    };
  }
}
