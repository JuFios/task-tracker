import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { AppConfig } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RefreshDto, RegisterDto } from './dto';

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_BYTES = 48;

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: AppConfig,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name.trim(),
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
      },
    });

    const tokens = await this.issueTokens(user.id, user.email);
    this.logger.log(`User registered: ${user.id}`);
    return { user: this.toSafeUser(user), ...tokens };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const passwordValid =
      user && (await bcrypt.compare(dto.password, user.passwordHash));

    if (!user || !passwordValid) {
      this.logger.warn(`Failed login attempt for email: ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.issueTokens(user.id, user.email);
    this.logger.log(`User logged in: ${user.id}`);
    return { user: this.toSafeUser(user), ...tokens };
  }

  /**
   * Rotates a refresh token: the presented token is consumed (deleted) and a
   * fresh pair is issued. A token that no longer exists means it was already
   * used or revoked — we fail closed and revoke nothing else (no token
   * families), see README trade-offs.
   *
   * Handles concurrent refresh requests from multiple tabs: if two requests
   * race on the same token, the first wins and the second gets a 401 so the
   * client can retry with the freshly-rotated token it already received via
   * BroadcastChannel.
   */
  async refresh(dto: RefreshDto): Promise<AuthResult> {
    const tokenHash = this.hashRefreshToken(dto.refreshToken);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const stored = await tx.refreshToken.findUnique({
          where: { tokenHash },
          include: { user: true },
        });

        if (!stored || stored.expiresAt < new Date()) {
          if (stored) {
            await tx.refreshToken.delete({ where: { id: stored.id } });
          }
          throw new UnauthorizedException('Refresh token is invalid or expired');
        }

        // Delete the old token
        await tx.refreshToken.delete({ where: { id: stored.id } });

        // Issue new tokens
        const tokens = await this.issueTokens(stored.userId, stored.user.email);
        return { user: this.toSafeUser(stored.user), ...tokens };
      });

      return result;
    } catch (error) {
      // P2025: record not found during delete — concurrent refresh consumed
      // this token first. Treat as invalid token so the client gets 401.
      if (
        error instanceof Error &&
        'code' in error &&
        (error as { code?: string }).code === 'P2025'
      ) {
        throw new UnauthorizedException('Refresh token is invalid or expired');
      }
      throw error;
    }
  }

  /** Revokes every refresh token of the user (logout from all devices). */
  async logout(userId: string): Promise<void> {
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
    if (count > 0) {
      this.logger.log(`User logged out: ${userId} (${count} tokens revoked)`);
    }
  }

  private async issueTokens(userId: string, email: string): Promise<AuthTokens> {
    const accessToken = await this.jwtService.signAsync(
      { sub: userId, email },
      {
        secret: this.config.jwtAccessSecret,
        expiresIn: this.config.accessTokenTtl,
      },
    );

    const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(
      Date.now() + this.config.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    );
    await this.prisma.refreshToken.create({
      data: { tokenHash: this.hashRefreshToken(refreshToken), userId, expiresAt },
    });

    return { accessToken, refreshToken };
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toSafeUser(user: {
    id: string;
    email: string;
    name: string;
    createdAt: Date;
  }): SafeUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }
}
