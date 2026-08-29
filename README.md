# Business Expense & Cash-Flow Tracker

A comprehensive financial management system for companies, providing income tracking, expense management, payroll processing, subscription management, multi-currency support, and profitability analysis. Designed for software houses, call centers, truck dispatching companies, digital agencies, and other small to medium-sized businesses.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn UI
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Testing**: Vitest (unit tests) + fast-check (property-based tests)

## Project Structure

```
expense-tracker/
├── app/                        # Next.js App Router pages
├── components/                 # React components
│   └── ui/                     # Shadcn UI primitives
├── lib/                        # Utility libraries
│   ├── hooks/                 # Shared client hooks
│   │   └── use-async-effect.ts
│   ├── supabase/              # Supabase client configuration
│   │   ├── client.ts          # Browser client
│   │   ├── env.ts             # Env var reading/validation
│   │   └── server.ts          # Server client
│   └── utils.ts               # General utilities
├── types/                     # TypeScript type definitions
│   └── index.ts               # All shared types
├── tests/                     # Test files
│   └── setup.ts               # Global test setup
├── proxy.ts                   # Auth session refresh (Next.js proxy convention)
├── .env.local                 # Environment variables (local)
├── .env.local.example         # Environment variables template
├── vitest.config.ts           # Vitest configuration
└── package.json               # Dependencies and scripts
```

## Getting Started

### Prerequisites

- Node.js 20+ 
- npm
- A Supabase project (for backend services)

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   
   Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:
   ```bash
   cp .env.local.example .env.local
   ```
   
   Edit `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

3. **Run database migrations**:
   
   (Migrations will be created in subsequent tasks)

4. **Start the development server**:
   ```bash
   npm run dev
   ```
   
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production (Turbopack)
- `npm run build:webpack` - Build for production with webpack (fallback when Turbopack cannot spawn workers locally)
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm test` - Run tests in watch mode
- `npm run test:ui` - Run tests with UI
- `npm run test:run` - Run tests once (CI mode)

## Testing

The project uses a dual testing approach:

### Unit Tests
- **Framework**: Vitest
- Test specific examples, edge cases, and error conditions
- Located alongside source files with `.test.ts` suffix

Example:
```typescript
import { describe, it, expect } from 'vitest';

describe('calculateNetSalary', () => {
  it('should calculate net salary correctly', () => {
    // test implementation
  });
});
```

### Property-Based Tests
- **Framework**: fast-check
- Verify universal properties across randomized inputs
- Each correctness property from the design doc maps to a property-based test
- Minimum 100 iterations per test

Example:
```typescript
import fc from 'fast-check';

// Feature: business-expense-cashflow-tracker, Property 4: net salary calculation
it('net salary equals sum of components', () => {
  fc.assert(
    fc.property(genPayroll(), (payroll) => {
      const expected =
        payroll.basicSalary + payroll.bonus - payroll.deduction;
      expect(calculateNetSalary(payroll)).toBeCloseTo(expected, 4);
    }),
    { numRuns: 100 }
  );
});
```

Run tests:
```bash
npm test              # Watch mode
npm run test:ui       # Interactive UI
npm run test:run      # Single run (for CI)
```

## Type System

All database entities and business logic types are defined in `types/index.ts`:
- Database entity interfaces (User, Expense, Income, etc.)
- Enum/union types (Role, ExpenseStatus, etc.)
- Value objects (MonetaryAmount, ProjectProfitability, etc.)
- API request/response types
- Role hierarchy utilities

## Architecture

This is a full-stack application using Next.js Server Actions and API Routes:

- **Frontend**: React components with Shadcn UI
- **Backend**: Next.js Server Actions / API Routes
- **Database**: Supabase (PostgreSQL) with Row-Level Security
- **Auth**: Supabase Auth with JWT sessions
- **Storage**: Supabase Storage for document uploads

## Development Guidelines

1. **Always read requirements and design docs** before implementing features
2. **Write both unit and property-based tests** for new functionality
3. **Use the defined TypeScript types** from `types/index.ts`
4. **Follow the approval workflow** for expense management
5. **Implement proper error handling** with validation errors
6. **Ensure RBAC** is enforced at both API and database (RLS) levels

## Spec Documents

All specification documents are located in `.kiro/specs/business-expense-cashflow-tracker/`:
- `requirements.md` - Detailed acceptance criteria
- `design.md` - System architecture and design
- `tasks.md` - Implementation task list

## License

Proprietary - All rights reserved

## Support

For questions or issues, please refer to the specification documents or contact the development team.
