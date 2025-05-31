# Development Guide

## Prerequisites

- [Bun](https://bun.sh/) >= 1.0.0

## Getting Started

1. Install dependencies:
   ```bash
   bun install
   ```

2. Run in development mode (with auto-reload):
   ```bash
   bun run dev
   ```

3. Run normally:
   ```bash
   bun start
   ```

## Development Commands

- `bun run dev` - Start development server with auto-reload
- `bun start` - Run the application
- `bun run build` - Build the application for production
- `bun test` - Run tests
- `bun run type-check` - Type check without emitting files
- `bun run lint` - Lint code with Biome
- `bun run lint:fix` - Lint and automatically fix issues
- `bun run format` - Format code with Biome

## Project Structure

```
├── src/
│   ├── index.ts          # Main entry point
│   └── index.test.ts     # Tests
├── dist/                 # Build output (generated)
├── package.json          # Project configuration
├── tsconfig.json         # TypeScript configuration
├── biome.json           # Biome linter/formatter configuration
└── .gitignore           # Git ignore rules
```

## Technology Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **Linting/Formatting**: Biome
- **Testing**: Bun's built-in test runner
- **File Watching**: chokidar (for file sync functionality)

## Development Tips

1. Use `bun run dev` for the best development experience with auto-reload
2. Run `bun run lint:fix` before committing to ensure code quality
3. Add tests for new functionality in the `*.test.ts` files
4. Use the built-in Bun APIs when possible for better performance