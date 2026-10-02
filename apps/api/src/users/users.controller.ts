import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../common/interfaces/auth-user.interface";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { UsersService } from "./users.service";
import { SafeUser } from "../auth/auth.service";

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @ApiOperation({ summary: "Get the currently authenticated user" })
  me(@CurrentUser() user: AuthUser): Promise<SafeUser> {
    return this.usersService.findById(user.id);
  }
}
