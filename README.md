# EA360

EA360 is a diagnostic and recommendation platform for businesses, providing structured interviews, dynamic profiling, and strategic budget allocations.

## Tech Stack
- **Frontend**: Next.js 14, React, Tailwind CSS, shadcn/ui
- **Backend/DB**: Supabase (PostgreSQL), Edge Functions
- **Language**: TypeScript

## Getting Started

### Prerequisites
- Node.js (v18+)
- Supabase CLI
- Docker (for running Supabase locally)

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the local Supabase instance:
   ```bash
   npx supabase start
   ```
4. Start the Next.js development server:
   ```bash
   npm run dev
   ```

### Default Credentials for Local Dev
- **Email**: admin@ea360.com
- **Password**: admin123

## Database Schema
The database uses a series of idempotent and additive migrations located in `supabase/migrations`. Key domains include:
- `businesses` & `users` (core tenants)
- `interviews` & `interview_questions` (diagnostic engine)
- `monetization_profiles` & `allocations` (strategic output)

To completely reset and re-seed the database locally:
```bash
npx supabase db reset
```

## Contributing
Please follow the standard Git workflow. Commits should be descriptive and reference any related stories or tasks.
