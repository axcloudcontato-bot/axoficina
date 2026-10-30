import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthResponse, RefreshResponse, SignupResponse } from '@oficina/contracts';
import { Public } from '../../../shared/decorators/public.decorator';
import { AUTH_THROTTLE } from '../../../shared/constants/throttle.constants';
import { AuthManager } from '../managers/auth.manager';
import { RevokeOtherSessionsDto, RevokeSessionDto, SessionsDto, ChangePasswordDto, ForgotPasswordDto, LoginDto, LogoutDto, RefreshDto, ResetPasswordDto, SignupDto } from '../dto/auth.dto';
import { PasswordResetService } from '../services/password-reset.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authManager: AuthManager, private readonly passwordReset: PasswordResetService) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('signup')
  async signup(@Body() body: SignupDto): Promise<SignupResponse> {
    return this.authManager.signup(body);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() body: LoginDto, @Headers('user-agent') userAgent?: string): Promise<AuthResponse> {
    return this.authManager.login(body, userAgent);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Body() body: RefreshDto, @Headers('user-agent') userAgent?: string): Promise<RefreshResponse> {
    return this.authManager.refresh(body.refreshToken, userAgent);
  }

  // Same answer whether the e-mail has an account or not.
  @Public()
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  async forgotPassword(@Body() body: ForgotPasswordDto): Promise<{ success: true }> {
    await this.passwordReset.request(body.email);
    return { success: true };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(@Body() body: ResetPasswordDto): Promise<{ success: true }> {
    await this.passwordReset.reset(body.token, body.password);
    return { success: true };
  }

  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  async changePassword(@CurrentUser() user: AuthenticatedUser, @Body() body: ChangePasswordDto, @Headers('user-agent') userAgent?: string): Promise<RefreshResponse> {
    return this.authManager.changePassword(user.userId, body.currentPassword, body.newPassword, userAgent);
  }

  // The devices signed in to the account of whoever asks. The body carries this device's refresh token to mark it.
  @HttpCode(HttpStatus.OK)
  @Post('sessions')
  async sessions(@CurrentUser() user: AuthenticatedUser, @Body() body: SessionsDto) {
    return this.authManager.sessions(user.userId, body.refreshToken);
  }

  @HttpCode(HttpStatus.OK)
  @Post('sessions/revoke')
  async revokeSession(@CurrentUser() user: AuthenticatedUser, @Body() body: RevokeSessionDto) {
    return this.authManager.revokeSession(user.userId, user.tenantId, body.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('sessions/revoke-others')
  async revokeOtherSessions(@CurrentUser() user: AuthenticatedUser, @Body() body: RevokeOtherSessionsDto) {
    return this.authManager.revokeOtherSessions(user.userId, user.tenantId, body.refreshToken);
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@Body() body: LogoutDto): Promise<void> {
    await this.authManager.logout(body);
  }
}
