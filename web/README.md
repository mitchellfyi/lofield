# Lofield FM - Frontend

This is the Next.js 16 frontend for Lofield FM, an AI-powered fictional radio station.

## Technology Stack

- **Next.js 16** with App Router and Cache Components
- **React 19** with server components
- **TypeScript** for type safety
- **Tailwind CSS v4** for styling
- **shadcn/ui** for UI components
- **Lucide React** for icons

## Getting Started

### Installation

```bash
npm install
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

### Building for Production

```bash
npm run build
npm start
```

### Code Quality

**Linting:**

```bash
npm run lint
```

**Formatting:**

```bash
npm run format
```

## Project Structure

```
web/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx         # Global layout with header/footer
│   ├── page.tsx           # Home page
│   ├── archive/           # Archive browsing page
│   └── [slug]/            # Dynamic show-specific pages
├── components/            # React components (via shadcn/ui)
├── lib/                   # Utility functions
└── public/                # Static assets
```

## Features

- **Responsive Design**: Works seamlessly on desktop and mobile
- **Cozy Lofi Theme**: Warm, muted color palette optimized for long listening sessions
- **Modern Next.js**: Utilizes App Router, Server Components, and Cache Components
- **Accessibility**: Built with semantic HTML and ARIA attributes

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)

## License

Part of the Lofield FM project.
