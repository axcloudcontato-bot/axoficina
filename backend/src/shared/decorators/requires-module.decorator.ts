import { SetMetadata } from '@nestjs/common';
import type { ModuleKey } from '@oficina/contracts';

export const REQUIRES_MODULE_KEY = 'requires-module';
// Marks a route or controller as sold separately: the workshop's plan must include the module.
export const RequiresModule = (module: ModuleKey) => SetMetadata(REQUIRES_MODULE_KEY, module);
