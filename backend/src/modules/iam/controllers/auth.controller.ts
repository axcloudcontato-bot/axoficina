import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthResponse, RefreshResponse, SignupResponse } from '@oficina/contracts';
import { Public } from '../../../shared/decorators/public.decorator';
import { AUTH_THROTTLE } from '../../../shared/constants/throttle.constants';
import { AuthManager } from '../managers/auth.manager';
import { ChangePasswordDto, ForgotPasswordDto, LoginDto, LogoutDto, RefreshDto, ResetPasswordDto, SignupDto } from '../dto/auth.dto';
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
  async login(@Body() body: LoginDto): Promise<AuthResponse> {
    return this.authManager.login(body);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Body() body: RefreshDto): Promise<RefreshResponse> {
    return this.authManager.refresh(body.refreshToken);
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
  async changePassword(@CurrentUser() user: AuthenticatedUser, @Body() body: ChangePasswordDto): Promise<RefreshResponse> {
    return this.authManager.changePassword(user.userId, body.currentPassword, body.newPassword);
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@Body() body: LogoutDto): Promise<void> {
    await this.authManager.logout(body);
  }
}
