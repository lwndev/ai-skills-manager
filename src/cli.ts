#!/usr/bin/env node

import { Command } from 'commander';
import { registerScaffoldCommand } from './commands/scaffold';

const program = new Command();

program
  .name('asm')
  .description('AI Skills Manager - CLI tool for managing Claude Code Agent Skills')
  .version('1.0.0');

registerScaffoldCommand(program);

program.parse();
