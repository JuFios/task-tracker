import { forwardRef, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { TasksController } from "./tasks.controller";
import { TasksGateway } from "./tasks.gateway";
import { TasksService } from "./tasks.service";

@Module({
  imports: [JwtModule.register({}), forwardRef(() => WorkspacesModule)],
  controllers: [TasksController],
  providers: [TasksService, TasksGateway],
  exports: [TasksGateway],
})
export class TasksModule {}
