# Contributing to Genesis

Thank you for your interest in contributing to Genesis! This document provides guidelines and information for contributors.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)

## 📜 Code of Conduct

Be respectful, inclusive, and professional in all interactions. We're building something great together!

## 🚀 Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/Genesis.git`
3. Add upstream remote: `git remote add upstream https://github.com/ORIGINAL_OWNER/Genesis.git`
4. Create a branch: `git checkout -b feature/your-feature-name`

## 💻 Development Setup

### Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher
- Git

### Installation

```bash
# Install dependencies
npm install

# Copy environment template (if exists)
cp .env.example .env.local

# Start development server
npm run dev
```

### Environment Variables

Create a `.env.local` file with:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_GEMINI_API_KEY=your_gemini_key
```

## 📁 Project Structure

```
Genesis/
├── components/     # React components
├── services/       # API and business logic services
├── hooks/          # Custom React hooks
├── contexts/       # React context providers
├── config/         # Configuration files
├── utils/          # Utility functions
├── types/          # TypeScript type definitions
├── public/         # Static assets
└── src/            # Source entry points
    └── test/       # Test utilities and setup
```

## 📝 Coding Standards

### TypeScript

- Use strict TypeScript - avoid `any`
- Define interfaces for component props
- Use proper return types on functions
- Prefer `const` over `let`

### React

- Prefer functional components with hooks
- Use proper TypeScript for component props
- Keep components focused and single-purpose
- Extract reusable logic into custom hooks

### Styling

- Use Tailwind CSS utility classes
- Follow mobile-first responsive design
- Use semantic color tokens from theme
- Maintain consistent spacing

### File Naming

- Components: `PascalCase.tsx` (e.g., `BookViewer.tsx`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `useAuth.ts`)
- Services: `camelCase.ts` (e.g., `geminiService.ts`)
- Types: `camelCase.ts` (e.g., `types.ts`)
- Tests: `ComponentName.test.tsx`

## 💾 Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

### Examples

```
feat(auth): add social login with Google
fix(book-viewer): resolve page navigation bug
docs(readme): update installation instructions
test(components): add LoadingSpinner tests
```

## 🔄 Pull Request Process

1. **Update your branch** with latest upstream changes:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run checks** before submitting:
   ```bash
   npm run type-check
   npm run format
   npm run test
   ```

3. **Create PR** with:
   - Clear title following commit conventions
   - Description of changes
   - Screenshots for UI changes
   - Link to related issues

4. **Review process**:
   - Address reviewer feedback
   - Keep commits clean (squash if needed)
   - Ensure CI passes

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run specific test file
npm run test -- LoadingSpinner.test.tsx
```

### Writing Tests

- Place tests next to the file being tested: `Component.test.tsx`
- Use descriptive test names
- Follow Arrange-Act-Assert pattern
- Mock external dependencies

### Example Test

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '../src/test/utils';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly with default props', () => {
    render(<MyComponent />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('handles click events', async () => {
    const handleClick = vi.fn();
    render(<MyComponent onClick={handleClick} />);
    
    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
```

## 🐛 Reporting Bugs

Open an issue with:
- Clear title and description
- Steps to reproduce
- Expected vs actual behavior
- Environment details (browser, OS)
- Screenshots if applicable

## 💡 Suggesting Features

Open an issue with:
- Clear problem statement
- Proposed solution
- Alternatives considered
- Additional context

---

Thank you for contributing! 🎉
